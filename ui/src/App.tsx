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

import React from 'react';
import { QueryCache, ReactQueryCacheProvider } from 'react-query';
import { ThemeProvider } from 'styled-components';
import GlobalStyle from 'core/assets/style/global';
import THEME from 'core/assets/themes';
import { setUserAbilities } from 'core/utils/abilities';
import { microfrontendKey } from 'core/utils/microfrontend';
import { baseQuery } from 'core/providers/base/query';
import Routes from './Routes';

const currentTheme = 'dark';
setUserAbilities();

const queryCache = new QueryCache({
  defaultConfig: {
    queries: {
      queryFn: baseQuery
    }
  }
});

export const setIsMicrofrontend = (isMicrofrontend?: boolean) => {
  localStorage.setItem(microfrontendKey, isMicrofrontend?.toString());
};

export const isMicrofrontend = () =>
  localStorage.getItem(microfrontendKey) === 'true';

interface Props {
  isMicrofrontend?: boolean;
}

function App({ isMicrofrontend }: Props) {
  setIsMicrofrontend(isMicrofrontend);

  return (
    <ReactQueryCacheProvider cache={queryCache}>
      <ThemeProvider theme={THEME[currentTheme]}>
        <Routes />
        <GlobalStyle />
      </ThemeProvider>
    </ReactQueryCacheProvider>
  );
}

export default App;
