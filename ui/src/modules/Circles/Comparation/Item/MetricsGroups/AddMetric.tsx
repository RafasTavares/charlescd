/*
 * Copyright 2020 ZUP IT SERVICOS EM TECNOLOGIA E INOVACAO SA
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useEffect } from 'react';
import { useForm, FormContext } from 'react-hook-form';
import Text from 'core/components/Text';
import { Option } from 'core/components/Form/Select/interfaces';
import { conditionOptions } from './constants';
import Input from 'core/components/Form/Input';
import { useMetricProviders, useSaveMetric, useProviderMetrics } from './hooks';
import { normalizeSelectOptions } from 'core/utils/select';
import { Metric, MetricFilter } from './types';
import {
  normalizeMetricOptions,
  getCondition,
  getSelectDefaultValue,
  buildMetricPayload,
  getBlankFilter
} from './helpers';
import BasicQueryForm from './BasicQueryForm';
import Styled from './styled';
import Button from 'core/components/Button/Default';

type Props = {
  id: string;
  onGoBack: Function;
  metric?: Metric;
};

const AddMetric = ({ onGoBack, id, metric }: Props) => {
  const [filters, setFilters] = useState<MetricFilter[]>([]);
  const formMethods = useForm<Metric>({
    mode: 'onChange',
    defaultValues: metric ?? {}
  });
  const {
    handleSubmit,
    register,
    control,
    formState: { isValid }
  } = formMethods;
  const [isBasicQuery, setIsBasicQuery] = useState(true);
  const { getMetricsProviders } = useMetricProviders();
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const { getAllDataSourceMetrics } = useProviderMetrics();
  const { saveMetric, status: creatingStatus } = useSaveMetric(metric?.id);
  const [providerOptions, setProviderOptions] = useState<Option[]>();
  const [showThresholdForm, setShowThresholdForm] = useState(false);
  const [metrics, setMetrics] = useState<Option[]>();
  const { watch } = formMethods;
  const watchDataSourceId = watch('dataSourceId');
  const canShowForm = watchDataSourceId || metric?.id;

  useEffect(() => {
    if (metric) {
      setIsBasicQuery(!!metric?.metric);
      setFilters(metric.filters);
    } else {
      setIsBasicQuery(true);
    }
  }, [metric]);

  useEffect(() => {
    setLoadingProviders(true);
    getMetricsProviders()
      .then(providersResponse => {
        const normalizedOptions = normalizeSelectOptions(providersResponse);
        setProviderOptions(normalizedOptions);
      })
      .finally(() => setLoadingProviders(false));
  }, [getMetricsProviders]);

  useEffect(() => {
    if (isBasicQuery && watchDataSourceId) {
      setLoadingMetrics(true);
      getAllDataSourceMetrics(watchDataSourceId)
        .then(metricsResponse => {
          const normalizedOptions = normalizeMetricOptions(metricsResponse);
          setMetrics(normalizedOptions);
        })
        .finally(() => setLoadingMetrics(false));
    }
  }, [isBasicQuery, watchDataSourceId, getAllDataSourceMetrics]);

  const onSubmit = async (data: Metric) => {
    const payload = buildMetricPayload(data, metric);
    saveMetric(id, payload).then(response => {
      if (response) {
        onGoBack();
      }
    });
  };

  const handleAddFilter = () => {
    const newFilters = [...filters, getBlankFilter()];
    setFilters(newFilters);
  };

  const handleRemoveFilter = (idToRemove: string) => {
    const newFilters = filters.filter(item => item.id !== idToRemove);
    setFilters(newFilters);
  };

  return (
    <>
      <Styled.Layer>
        <Styled.Icon
          name="arrow-left"
          color="dark"
          onClick={() => onGoBack()}
        />
      </Styled.Layer>
      <Styled.Layer>
        <Text.h2 color="light">
          {metric?.id ? 'Update metric' : 'Add metric'}
        </Text.h2>
      </Styled.Layer>
      <FormContext {...formMethods}>
        <Styled.Form
          onSubmit={handleSubmit(onSubmit)}
          data-testid="create-metric"
        >
          <Styled.Layer>
            <Styled.Input
              name="nickname"
              ref={register({ required: true })}
              label="Type a nickname for metric"
            />

            {!loadingProviders && (
              <Styled.ProviderSelect
                control={control}
                name="dataSourceId"
                label="Select a data source"
                options={providerOptions}
                rules={{ required: true }}
                defaultValue={getSelectDefaultValue(
                  metric?.dataSourceId,
                  providerOptions
                )}
              />
            )}

            {canShowForm && (
              <>
                <Text.h5 color="dark">
                  You can fill your query in a basic or advanced way:
                </Text.h5>
                <Styled.Actions>
                  <Styled.ButtonIconRounded
                    color="dark"
                    onClick={() => setIsBasicQuery(true)}
                    isActive={isBasicQuery}
                  >
                    Basic
                  </Styled.ButtonIconRounded>
                  <Styled.ButtonIconRounded
                    color="dark"
                    onClick={() => setIsBasicQuery(false)}
                    isActive={!isBasicQuery}
                  >
                    Advanced
                  </Styled.ButtonIconRounded>
                </Styled.Actions>

                {isBasicQuery && (
                  <>
                    {!loadingMetrics && (
                      <Styled.ProviderSelect
                        control={control}
                        name="metric"
                        label="Select a metric"
                        options={metrics}
                        rules={{ required: true }}
                        defaultValue={getSelectDefaultValue(
                          metric?.metric,
                          metrics
                        )}
                      />
                    )}
                    <BasicQueryForm
                      filters={filters}
                      onAddFilter={handleAddFilter}
                      onRemoveFilter={handleRemoveFilter}
                    />
                  </>
                )}

                {!isBasicQuery && (
                  <>
                    <Styled.AdvancedQueryWrapper>
                      <Input
                        name="query"
                        ref={register({ required: true })}
                        label="Type a query"
                      />
                    </Styled.AdvancedQueryWrapper>
                  </>
                )}

                <Styled.Title color="light">Threshold</Styled.Title>
                <Styled.Subtitle color="dark">
                  Set the threshold to indicate when to reach the configured
                  numeric value.
                </Styled.Subtitle>

                {!showThresholdForm && !metric?.condition && (
                  <Styled.ButtonAdd
                    name="add"
                    icon="add"
                    color="dark"
                    onClick={() => setShowThresholdForm(true)}
                  >
                    Add threshold
                  </Styled.ButtonAdd>
                )}

                {(showThresholdForm || metric?.condition) && (
                  <Styled.ThresholdWrapper>
                    <Styled.ThresholdSelect
                      options={conditionOptions}
                      control={control}
                      rules={{ required: true }}
                      label="Conditional"
                      name="condition"
                      defaultValue={getCondition(metric?.condition)}
                    />

                    <Styled.InputNumber
                      name="threshold"
                      label="Threshold"
                      ref={register({ required: true })}
                    />
                  </Styled.ThresholdWrapper>
                )}

                <Button
                  type="submit"
                  isLoading={creatingStatus.isPending}
                  isDisabled={!isValid}
                >
                  Save
                </Button>
              </>
            )}
          </Styled.Layer>
        </Styled.Form>
      </FormContext>
    </>
  );
};

export default AddMetric;