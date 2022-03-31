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

import { type Hashable, ContentType, hashArray } from '@finos/legend-shared';
import { computed, makeObservable, observable } from 'mobx';
import type { Binding } from '../store/DSLExternalFormat_Binding';
import type { UrlStream } from './DSLExternalFormat_UrlStream';
import {
  Connection,
  type ConnectionVisitor,
} from '../../connection/Connection';
import type { PackageableElementReference } from '../../PackageableElementReference';
import { DSL_EXTERNAL_FORMAT_HASH_STRUCTURE } from '../../../../../DSLExternalFormat_ModelUtils';

export class ExternalFormatConnection extends Connection implements Hashable {
  static readonly CONTENT_TYPE = ContentType.TEXT_PLAIN;
  externalSource!: UrlStream;

  constructor(store: PackageableElementReference<Binding>) {
    super(store);

    makeObservable(this, {
      externalSource: observable,
      hashCode: computed,
    });
  }

  setSource(value: UrlStream): void {
    this.externalSource = value;
  }

  get hashCode(): string {
    return hashArray([
      DSL_EXTERNAL_FORMAT_HASH_STRUCTURE.EXTERNAL_FORMAT_CONNECTION,
      this.store.hashValue,
      this.externalSource,
    ]);
  }

  accept_ConnectionVisitor<T>(visitor: ConnectionVisitor<T>): T {
    return visitor.visit_Connection(this);
  }
}
