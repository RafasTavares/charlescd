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

import { setAccessToken, setRefreshToken, isLogged } from '../auth';

test('is logged', () => {
  setAccessToken('accessToken');
  setRefreshToken('refreshToken');

  expect(isLogged()).toBeTruthy();
});

test('set access-token in localstorage', () => {
  setAccessToken('accessToken');
  const accessToken = localStorage.getItem('access-token');

  expect(accessToken).toContain('accessToken');
});

test('set refresh-token in cookie ', () => {
  setRefreshToken('refreshToken');
  const refreshToken = localStorage.getItem('refresh-token');
  expect(refreshToken).toContain('refreshToken');
});
