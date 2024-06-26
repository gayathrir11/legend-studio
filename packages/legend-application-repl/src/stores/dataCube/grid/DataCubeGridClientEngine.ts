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

import type {
  IServerSideDatasource,
  IServerSideGetRowsParams,
  IServerSideGetRowsRequest,
} from '@ag-grid-community/core';
import type { DataCubeGridState } from './DataCubeGridState.js';
import {
  cloneSnapshot,
  type DataCubeQuerySnapshot,
  type DataCubeQuerySnapshotSortColumn,
} from '../core/DataCubeQuerySnapshot.js';
import {
  LogEvent,
  assertErrorThrown,
  deepEqual,
  guaranteeNonNullable,
  isBoolean,
} from '@finos/legend-shared';
import { buildExecutableQueryFromSnapshot } from '../core/DataCubeQueryBuilder.js';
import { type TabularDataSet, V1_Lambda } from '@finos/legend-graph';
import { DATA_CUBE_COLUMN_SORT_DIRECTION } from '../DataCubeMetaModelConst.js';
import { APPLICATION_EVENT } from '@finos/legend-application';

export type GridClientResultCellDataType =
  | string
  | number
  | boolean
  | null
  | undefined;

export type GridClientRowDataType = {
  [key: string]: GridClientResultCellDataType;
};

export enum GridClientSortDirection {
  ASCENDING = 'asc',
  DESCENDING = 'desc',
}

export const toRowData = (tds: TabularDataSet): GridClientRowDataType[] =>
  tds.rows.map((_row, rowIdx) => {
    const row: GridClientRowDataType = {};
    const cols = tds.columns;
    _row.values.forEach((value, colIdx) => {
      // `ag-grid` shows `false` value as empty string so we have
      // call `.toString()` to avoid this behavior.
      row[cols[colIdx] as string] = isBoolean(value) ? String(value) : value;
    });
    row.rowNumber = rowIdx;
    return row;
  });

export class DataCubeGridClientServerSideDataSource
  implements IServerSideDatasource
{
  readonly grid: DataCubeGridState;

  constructor(grid: DataCubeGridState) {
    this.grid = grid;
  }

  async fetchRows(
    params: IServerSideGetRowsParams<unknown, unknown>,
  ): Promise<void> {
    const currentSnapshot = guaranteeNonNullable(this.grid.getLatestSnapshot());
    const syncedSnapshot = this.syncSnapshot(params.request, currentSnapshot);
    if (syncedSnapshot.uuid !== currentSnapshot.uuid) {
      this.grid.publishSnapshot(syncedSnapshot);
    }
    try {
      const executableQuery = buildExecutableQueryFromSnapshot(syncedSnapshot);
      const lambda = new V1_Lambda();
      lambda.body.push(executableQuery);
      const result = await this.grid.dataCubeState.engine.executeQuery(lambda);
      const rowData = toRowData(result.result);
      params.success({ rowData });
    } catch (error) {
      assertErrorThrown(error);
      this.grid.dataCubeState.applicationStore.notificationService.notifyError(
        error,
      );
      params.fail();
    }
  }

  getRows(params: IServerSideGetRowsParams<unknown, unknown>): void {
    this.fetchRows(params).catch((error: unknown) => {
      assertErrorThrown(error);
      this.grid.dataCubeState.applicationStore.logService.error(
        LogEvent.create(APPLICATION_EVENT.ILLEGAL_APPLICATION_STATE_OCCURRED),
        `Error ocurred while fetching data for grid should have been handled gracefully`,
        error,
      );
    });
  }

  private syncSnapshot(
    request: IServerSideGetRowsRequest,
    baseSnapshot: DataCubeQuerySnapshot,
  ): DataCubeQuerySnapshot {
    let createNew = false;

    // --------------------------------- GROUP BY ---------------------------------
    // TODO: @akphi - Implement this

    // --------------------------------- SORT ---------------------------------

    const newSortColumns: DataCubeQuerySnapshotSortColumn[] =
      request.sortModel.map((sortInfo) => {
        const column = guaranteeNonNullable(
          baseSnapshot.columns.find((col) => col.name === sortInfo.colId),
        );
        return {
          name: sortInfo.colId,
          type: column.type,
          direction:
            sortInfo.sort === GridClientSortDirection.ASCENDING
              ? DATA_CUBE_COLUMN_SORT_DIRECTION.ASCENDING
              : DATA_CUBE_COLUMN_SORT_DIRECTION.DESCENDING,
        };
      });

    if (!deepEqual(newSortColumns, baseSnapshot.sortColumns)) {
      createNew = true;
    }

    // --------------------------------- FINALIZE ---------------------------------

    if (createNew) {
      const newSnapshot = cloneSnapshot(baseSnapshot);
      newSnapshot.sortColumns = newSortColumns;
      return newSnapshot;
    }
    return baseSnapshot;
  }
}
