import {
  forwardRef,
  HttpService,
  Inject,
  Injectable
} from '@nestjs/common'
import { IPipelineOptions, IPipelineCircle } from '../../../api/components/interfaces'
import { AppConstants } from '../../constants'
import { IDeploymentConfiguration } from '../configuration/interfaces'
import { QueuedPipelineTypesEnum } from '../../../api/deployments/enums'
import { ConsoleLoggerService } from '../../logs/console'
import { IConsulKV } from '../consul/interfaces'
import {
  ComponentDeploymentEntity,
  ComponentUndeploymentEntity,
  DeploymentEntity,
  ModuleDeploymentEntity,
  QueuedDeploymentEntity,
  QueuedUndeploymentEntity
} from '../../../api/deployments/entity'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PipelineErrorHandlerService } from '../../../api/deployments/services'
import {
  ComponentDeploymentsRepository,
  ComponentUndeploymentsRepository,
  QueuedDeploymentsRepository
} from '../../../api/deployments/repository'
import { IBaseVirtualService, IEmptyVirtualService } from '../spinnaker/connector/interfaces'
import { createEmptyVirtualService, createVirtualService } from '../spinnaker/connector/utils/manifests/base-virtual-service'
import { ISpinnakerPipelineConfiguration } from '../spinnaker/interfaces'
import createDestinationRules from '../spinnaker/connector/utils/manifests/base-destination-rules'

interface IOctopipeVersion {
  version: string
  versionUrl: string
}

export interface IOctopipeConfiguration {
  hosts?: string[],
  versions: IOctopipeVersion[],
  unusedVersions: IOctopipeVersion[],
  istio: {
    virtualService: {},
    destinationRules: {}
  },
  appName: string,
  appNamespace: string
  webHookUrl: string,
  github: {
    username?: string,
    password?: string,
    token?: string
  },
  helmUrl: string
}

@Injectable()
export class OctopipeService {

  constructor(
    private readonly httpService: HttpService,
    private readonly consoleLoggerService: ConsoleLoggerService,
    @Inject(AppConstants.CONSUL_PROVIDER)
    private readonly consulConfiguration: IConsulKV,
    @InjectRepository(DeploymentEntity)
    private readonly deploymentsRepository: Repository<DeploymentEntity>,
    @InjectRepository(QueuedDeploymentsRepository)
    private readonly queuedDeploymentsRepository: QueuedDeploymentsRepository,
    @InjectRepository(ComponentUndeploymentsRepository)
    private readonly componentUndeploymentsRepository: ComponentUndeploymentsRepository,
    @InjectRepository(ComponentDeploymentsRepository)
    private readonly componentDeploymentsRepository: ComponentDeploymentsRepository,
    @Inject(forwardRef(() => PipelineErrorHandlerService))
    private readonly pipelineErrorHandlingService: PipelineErrorHandlerService
  ) { }

  public async createDeployment(
    pipelineCirclesOptions: IPipelineOptions,
    deploymentConfiguration: IDeploymentConfiguration,
    componentDeploymentId: string,
    deploymentId: string,
    circleId: string,
    pipelineCallbackUrl: string,
    queueId: number
  ): Promise<void> {

    const componentDeploymentEntity: ComponentDeploymentEntity =
      await this.componentDeploymentsRepository.getOneWithRelations(componentDeploymentId)
    const payload: IOctopipeConfiguration =
      this.createPipelineConfigurationObject(
        pipelineCirclesOptions, deploymentConfiguration, circleId, pipelineCallbackUrl, componentDeploymentEntity.moduleDeployment
      )

    // decidir rota, fazer post com payload da configuration
    // payload.istio.virtualService = this.buildVirtualServices(spinnakerPipelineConfiguration)
    payload.istio.virtualService = this.buildVirtualServices(
      deploymentConfiguration.appName,
      deploymentConfiguration.appNamespace,
      pipelineCirclesOptions.pipelineCircles,
      pipelineCallbackUrl,
      [deploymentConfiguration.appName],
      pipelineCirclesOptions.pipelineVersions
    )
    payload.istio.destinationRules = createDestinationRules(
      deploymentConfiguration.appName,
      deploymentConfiguration.appNamespace,
      pipelineCirclesOptions.pipelineCircles,
      pipelineCirclesOptions.pipelineVersions
    )
    this.deploy(payload, deploymentId, queueId)
  }

  public async deploy(
    payload: IOctopipeConfiguration,
    deploymentId: string,
    queueId: number
  ): Promise<void> {

    try {
      this.consoleLoggerService.log(`START:DEPLOY_OCTOPIPE_PIPELINE`)
      await this.httpService.post(
        `${this.consulConfiguration.octopipeUrl}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ).toPromise()
      this.consoleLoggerService.log(`FINISH:DEPLOY_OCTOPIPE_PIPELINE`)
    } catch (error) {
      await this.handleDeploymentFailure(deploymentId, queueId)
    }
  }

  private createPipelineConfigurationObject(
    pipelineCirclesOptions: IPipelineOptions,
    deploymentConfiguration: IDeploymentConfiguration,
    circleId: string,
    pipelineCallbackUrl: string,
    moduleDeployment: ModuleDeploymentEntity
  ): IOctopipeConfiguration {

    return {
      appName: deploymentConfiguration.appName,
      appNamespace: deploymentConfiguration.appNamespace,
      github: { username: 'aaa', password: 'bbb' },
      helmUrl: moduleDeployment.helmRepository,
      istio: { virtualService: {}, destinationRules: {} }, // buscar do compiler de virtualservice
      unusedVersions: pipelineCirclesOptions.pipelineUnusedVersions,
      versions: pipelineCirclesOptions.pipelineVersions,
      webHookUrl: pipelineCallbackUrl
    }
  }

  private async handleDeploymentFailure(deploymentId: string, queueId: number): Promise<void> {
    this.consoleLoggerService.error(`ERROR:DEPLOY_OCTOPIPE_PIPELINE ${deploymentId} ${queueId}`)
    const queuedDeployment: QueuedDeploymentEntity = await this.queuedDeploymentsRepository.findOne({ id: queueId })

    if (queuedDeployment.type === QueuedPipelineTypesEnum.QueuedDeploymentEntity) {
      await this.handleQueuedDeploymentFailure(queuedDeployment, deploymentId)
    } else {
      await this.handleQueuedUndeploymentFailure(queuedDeployment as QueuedUndeploymentEntity)
    }
  }

  private async handleQueuedDeploymentFailure(queuedDeployment: QueuedDeploymentEntity, deploymentId: string): Promise<void> {
    const deployment: DeploymentEntity = await this.deploymentsRepository.findOne({ id: deploymentId })
    const componentDeployment: ComponentDeploymentEntity =
      await this.componentDeploymentsRepository.findOne({ id: queuedDeployment.componentDeploymentId })

    await this.pipelineErrorHandlingService.handleComponentDeploymentFailure(componentDeployment, queuedDeployment, deployment.circle)
    await this.pipelineErrorHandlingService.handleDeploymentFailure(deployment)
  }

  private async handleQueuedUndeploymentFailure(queuedUndeployment: QueuedUndeploymentEntity): Promise<void> {
    const componentUndeployment: ComponentUndeploymentEntity =
      await this.componentUndeploymentsRepository.getOneWithRelations(queuedUndeployment.componentUndeploymentId)
    const componentDeployment: ComponentDeploymentEntity =
      await this.componentDeploymentsRepository.getOneWithRelations(queuedUndeployment.componentDeploymentId)
    const { moduleUndeployment: { undeployment } } = componentUndeployment

    await this.pipelineErrorHandlingService.handleComponentUndeploymentFailure(componentDeployment, queuedUndeployment)
    await this.pipelineErrorHandlingService.handleUndeploymentFailure(undeployment)
  }

  private buildVirtualServices(
    appName: string, appNamespace: string, circles: IPipelineCircle[], uri: string, hosts: string[], versions: IOctopipeVersion[]
  ) {
    const virtualService: IBaseVirtualService | IEmptyVirtualService =
      versions.length === 0
        ? createEmptyVirtualService(appName, appNamespace)
        : createVirtualService(appName, appNamespace, circles, uri, hosts)
    return virtualService
  }
}
