package metricsgroup

import (
	"compass/internal/metric"
	"compass/internal/util"
	"compass/pkg/datasource"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"sort"

	"github.com/google/uuid"
	"github.com/jinzhu/gorm"
)

type MetricsGroup struct {
	util.BaseModel
	Name        string    `json:"name"`
	Metrics     []metric.Metric  `json:"metrics"`
	WorkspaceID uuid.UUID `json:"-"`
	CircleID    uuid.UUID `json:"circleId"`
}

type MetricGroupResume struct {
	util.BaseModel
	Name              string `json:"name"`
	Thresholds        int    `json:"thresholds"`
	ThresholdsReached int    `json:"thresholdsReached"`
	Metrics           int    `json:"metricsCount"`
}

func (metricsGroup MetricsGroup) Validate() []error {
	ers := make([]error, 0)

	if metricsGroup.Name == "" {
		ers = append(ers, errors.New("Name is required"))
	}

	if metricsGroup.CircleID == uuid.Nil {
		ers = append(ers, errors.New("CircleID is required"))
	}

	for _, m := range metricsGroup.Metrics {
		if len(m.Validate()) > 0 {
			ers = append(ers, m.Validate()...)
		}
	}

	return ers
}

type Condition int

const (
	EQUAL Condition = iota
	GREATER_THEN
	LOWER_THEN
)

var Periods = map[string]string{
	"s":   "s",
	"m":   "m",
	"h":   "h",
	"d":   "d",
	"w":   "w",
	"y":   "y",
	"MAX": "MAX",
}

func (c Condition) String() string {
	return [...]string{"EQUAL", "GREATER_THEN", "LOWER_THEN"}[c]
}

func (main Main) PeriodValidate(currentPeriod string) error {
	reg, err := regexp.Compile("[0-9]")
	if err != nil {
		util.Error(util.PeriodValidateRegexError, "PeriodValidate", err, currentPeriod)
		return err
	}

	if currentPeriod != "" && !reg.Match([]byte(currentPeriod)) {
		err := errors.New("Invalid period: not found number")
		util.Error(util.PeriodValidateError, "PeriodValidate", err, currentPeriod)
		return err
	}

	unit := reg.ReplaceAllString(currentPeriod, "")
	_, ok := Periods[unit]
	if !ok && currentPeriod != "" {
		err := errors.New("Invalid period: not found unit")
		util.Error(util.PeriodValidateError, "PeriodValidate", err, currentPeriod)
		return err
	}

	return nil
}

func (main Main) Parse(metricsGroup io.ReadCloser) (MetricsGroup, error) {
	var newMetricsGroup *MetricsGroup
	err := json.NewDecoder(metricsGroup).Decode(&newMetricsGroup)
	if err != nil {
		util.Error(util.GeneralParseError, "Parse", err, metricsGroup)
		return MetricsGroup{}, err
	}
	return *newMetricsGroup, nil
}

func (main Main) FindAll() ([]MetricsGroup, error) {
	var metricsGroups []MetricsGroup
	db := main.db.Set("gorm:auto_preload", true).Find(&metricsGroups)
	if db.Error != nil {
		util.Error(util.FindMetricsGroupError, "FindAll", db.Error, metricsGroups)
		return []MetricsGroup{}, db.Error
	}
	return metricsGroups, nil
}

func (main Main) ResumeByCircle(circleId string) ([]MetricGroupResume, error) {
	var db *gorm.DB
	var metricsGroups []MetricsGroup
	var metricsGroupsResume []MetricGroupResume

	if circleId == "" {
		db = main.db.Set("gorm:auto_preload", true).Find(&metricsGroups)
	} else {
		circleIdParsed, _ := uuid.Parse(circleId)
		db = main.db.Set("gorm:auto_preload", true).Where("circle_id=?", circleIdParsed).Find(&metricsGroups)
	}

	if db.Error != nil {
		util.Error(util.ResumeByCircleError, "ResumeByCircle", db.Error, metricsGroups)
		return []MetricGroupResume{}, db.Error
	}

	for _, group := range metricsGroups {
		metricsGroupsResume = append(metricsGroupsResume, MetricGroupResume{
			group.BaseModel,
			group.Name,
			main.metricMain.CountAllMetricsWithConditions(group.Metrics),
			main.metricMain.CountAllMetricsFinished(group.Metrics),
			main.metricMain.CountAllMetricsInGroup(group.Metrics),
		})
	}

	main.sortResumeMetrics(metricsGroupsResume)

	return metricsGroupsResume, nil
}

func (main Main) sortResumeMetrics(metricsGroupResume []MetricGroupResume) {

	sort.SliceStable(metricsGroupResume, func(i, j int) bool {

		if (metricsGroupResume[i].ThresholdsReached == metricsGroupResume[i].Thresholds) &&
			(metricsGroupResume[j].ThresholdsReached == metricsGroupResume[j].Thresholds) &&
			(metricsGroupResume[i].ThresholdsReached > metricsGroupResume[j].ThresholdsReached) {
			return true
		}

		if metricsGroupResume[i].Thresholds == 0 {
			return false
		}

		if metricsGroupResume[j].Thresholds == 0 {
			return true
		}

		if metricsGroupResume[i].ThresholdsReached == metricsGroupResume[i].Thresholds {
			return true
		}

		if metricsGroupResume[j].ThresholdsReached == metricsGroupResume[j].Thresholds {
			return false
		}

		if metricsGroupResume[i].ThresholdsReached == 0 && metricsGroupResume[j].ThresholdsReached == 0 {
			return metricsGroupResume[i].Thresholds > metricsGroupResume[j].Thresholds
		}

		return metricsGroupResume[i].ThresholdsReached > metricsGroupResume[j].ThresholdsReached

	})
}

func (main Main) Save(metricsGroup MetricsGroup) (MetricsGroup, error) {
	db := main.db.Create(&metricsGroup)
	if db.Error != nil {
		util.Error(util.SaveMetricsGroupError, "Save", db.Error, metricsGroup)
		return MetricsGroup{}, db.Error
	}
	return metricsGroup, nil
}

func (main Main) FindById(id string) (MetricsGroup, error) {
	metricsGroup := MetricsGroup{}
	db := main.db.Set("gorm:auto_preload", true).Where("id = ?", id).First(&metricsGroup)
	if db.Error != nil {
		util.Error(util.FindMetricsGroupError, "FindById", db.Error, "Id = "+id)
		return MetricsGroup{}, db.Error
	}
	return metricsGroup, nil
}

func (main Main) FindCircleMetricGroups(circleId string) ([]MetricsGroup, error) {
	var metricsGroups []MetricsGroup
	db := main.db.Set("gorm:auto_preload", true).Where("circle_id = ?", circleId).Find(&metricsGroups)
	if db.Error != nil {
		util.Error(util.FindMetricsGroupError, "FindCircleMetricGroups", db.Error, "CircleId= "+circleId)
		return []MetricsGroup{}, db.Error
	}
	return metricsGroups, nil
}

func (main Main) Update(id string, metricsGroup MetricsGroup) (MetricsGroup, error) {
	db := main.db.Table("metrics_groups").Where("id = ?", id).Update(&metricsGroup)
	if db.Error != nil {
		util.Error(util.UpdateMetricsGroupError, "Update", db.Error, metricsGroup)
		return MetricsGroup{}, db.Error
	}
	return metricsGroup, nil
}

func (main Main) Remove(id string) error {
	db := main.db.Where("id = ?", id).Delete(MetricsGroup{})
	if db.Error != nil {
		util.Error(util.RemoveMetricsGroupError, "Remove", db.Error, id)
		return db.Error
	}
	return nil
}

func (main Main) QueryByGroupID(id, period string) ([]datasource.MetricValues, error) {
	var metricsValues []datasource.MetricValues
	metricsGroup, err := main.FindById(id)
	if err != nil {
		notFoundErr := errors.New("Not found metrics group: " + id)
		util.Error(util.FindMetricsGroupError, "QueryByGroupID", notFoundErr, id)
		return nil, notFoundErr
	}

	for _, metric := range metricsGroup.Metrics {

		query, err := main.metricMain.Query(metric, period)
		if err != nil {
			util.Error(util.QueryByGroupIdError, "QueryByGroupID", err, metric)
			return nil, err
		}

		metricsValues = append(metricsValues, datasource.MetricValues{
			ID:       metric.ID,
			Nickname: metric.Nickname,
			Values:   query,
		})
	}

	return metricsValues, nil
}

func (main Main) ResultByGroup(group MetricsGroup) ([]datasource.MetricResult, error) {
	var metricsResults []datasource.MetricResult
	for _, metric := range group.Metrics {

		result, err := main.metricMain.ResultQuery(metric)
		if err != nil {
			util.Error(util.ResultQueryError, "ResultByGroup", err, metric)
			return nil, err
		}

		metricsResults = append(metricsResults, datasource.MetricResult{
			ID:       metric.ID,
			Nickname: metric.Nickname,
			Result:   result,
		})
	}

	return metricsResults, nil
}

func (main Main) ResultByID(id string) ([]datasource.MetricResult, error) {
	metricsGroup, err := main.FindById(id)
	if err != nil {
		notFoundErr := errors.New("Not found metrics group: " + id)
		util.Error(util.FindMetricsGroupError, "ResultByID", notFoundErr, id)
		return nil, notFoundErr
	}

	return main.ResultByGroup(metricsGroup)
}