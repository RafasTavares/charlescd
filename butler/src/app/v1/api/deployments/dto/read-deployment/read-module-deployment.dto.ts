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

import { ReadComponentDeploymentDto } from './read-component-deployment.dto'

export class ReadModuleDeploymentDto {

  public readonly id: string

  public readonly moduleId: string

  public readonly helmRepository: string

  public readonly componentsDeployments: ReadComponentDeploymentDto[]

  public readonly status: string

  public readonly createdAt: Date

  constructor(
    id: string,
    moduleId: string,
    helmRepository: string,
    componentsDeployments: ReadComponentDeploymentDto[],
    status: string,
    createdAt: Date
  ) {
    this.id = id
    this.moduleId = moduleId
    this.helmRepository = helmRepository
    this.componentsDeployments = componentsDeployments
    this.status = status
    this.createdAt = createdAt
  }
}
