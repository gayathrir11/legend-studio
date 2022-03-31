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

import { computed, observable, makeObservable, override } from 'mobx';
import { CORE_HASH_STRUCTURE } from '../../../../../MetaModelConst';
import { type Hashable, hashArray } from '@finos/legend-shared';
import {
  type PackageableElementVisitor,
  PackageableElement,
  PACKAGEABLE_ELEMENT_POINTER_TYPE,
  getElementPointerHashCode,
} from '../PackageableElement';
import type { PackageableElementReference } from '../PackageableElementReference';
import type { FileGenerationSpecification } from '../fileGeneration/FileGenerationSpecification';

// NOTE: As of now the tree only supports a linear order of generation. This is because the only use case is linear,
// but the shape has been left as a tree to support 'branching' off in the future.
export class GenerationTreeNode implements Hashable {
  generationElement: PackageableElementReference<PackageableElement>;
  id: string;
  parent?: GenerationTreeNode | undefined;

  constructor(
    generationElement: PackageableElementReference<PackageableElement>,
    id?: string,
  ) {
    makeObservable(this, {
      id: observable,
      parent: observable,
      hashCode: computed,
    });

    this.generationElement = generationElement;
    this.id = id ?? generationElement.value.path;
  }

  get hashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.GENERATION_TREE_NODE,
      this.generationElement.hashValue,
      this.id,
    ]);
  }
}

export class GenerationSpecification
  extends PackageableElement
  implements Hashable
{
  generationNodes: GenerationTreeNode[] = [];
  fileGenerations: PackageableElementReference<FileGenerationSpecification>[] =
    [];

  constructor(name: string) {
    super(name);

    makeObservable<GenerationSpecification, '_elementHashCode'>(this, {
      generationNodes: observable,
      fileGenerations: observable,
      _elementHashCode: override,
    });
  }

  findGenerationElementById(id: string): PackageableElement | undefined {
    return this.generationNodes.find((node) => node.id === id)
      ?.generationElement.value;
  }

  protected override get _elementHashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.GENERATION_TREE,
      this.path,
      hashArray(this.generationNodes),
      hashArray(
        this.fileGenerations.map((fileGeneration) =>
          getElementPointerHashCode(
            PACKAGEABLE_ELEMENT_POINTER_TYPE.FILE_GENERATION,
            fileGeneration.hashValue,
          ),
        ),
      ),
    ]);
  }

  accept_PackageableElementVisitor<T>(
    visitor: PackageableElementVisitor<T>,
  ): T {
    return visitor.visit_GenerationSpecification(this);
  }
}
