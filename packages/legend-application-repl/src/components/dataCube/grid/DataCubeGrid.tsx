/**
 * Copyright (c) 2020-present, Goldman Sachs
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

import { observer } from 'mobx-react-lite';
import type { REPLStore } from '../../../stores/dataCube/DataCubeStore.js';
import { LicenseManager } from '@ag-grid-enterprise/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ServerSideRowModelModule } from '@ag-grid-enterprise/server-side-row-model';
import { RowGroupingModule } from '@ag-grid-enterprise/row-grouping';
import { MenuModule } from '@ag-grid-enterprise/menu';
import { AgGridReact } from '@ag-grid-community/react';
import { useEffect } from 'react';

// NOTE: This is a workaround to prevent ag-grid license key check from flooding the console screen
// with its stack trace in Chrome.
// We MUST NEVER completely surpress this warning, else it's a violation of the ag-grid license
const __INTERNAL__original_console_error = console.error; // eslint-disable-line no-console
// eslint-disable-next-line no-process-env
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.error = (message?: unknown, ...optionalParams: unknown[]): void => {
    console.log(message); // eslint-disable-line no-console
  };
}

export const DataCubeGrid = observer((props: { editorStore: REPLStore }) => {
  const { editorStore } = props;
  const dataCubeState = editorStore.dataCubeState;

  useEffect(() => {
    if (dataCubeState.grid.clientLicenseKey) {
      LicenseManager.setLicenseKey(dataCubeState.grid.clientLicenseKey);
    }
  }, [dataCubeState.grid.clientLicenseKey]);

  return (
    <>
      <AgGridReact
        rowGroupPanelShow="always"
        suppressBrowserResizeObserver={true}
        suppressScrollOnNewData={true}
        alwaysMultiSort={true}
        rowModelType="serverSide"
        serverSideDatasource={dataCubeState.grid.clientDataSource}
        modules={[
          // community
          ClientSideRowModelModule,
          // enterprise
          ServerSideRowModelModule,
          RowGroupingModule,
          MenuModule,
        ]}
        onGridReady={(params): void => {
          dataCubeState.grid.configureClient(params.api);
          // eslint-disable-next-line no-process-env
          if (process.env.NODE_ENV === 'development') {
            console.error = __INTERNAL__original_console_error; // eslint-disable-line no-console
          }
        }}
        className="ag-theme-balham"
      />
    </>
  );
});
