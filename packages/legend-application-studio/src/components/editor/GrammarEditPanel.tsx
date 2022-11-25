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

import { TabManager, type TabState } from '@finos/legend-application';
import { ContextMenu, clsx, WordWrapIcon } from '@finos/legend-art';
import { observer } from 'mobx-react-lite';
import { GrammarTextEditorState } from '../../stores/editor-state/GrammarTextEditorState.js';
import { GrammarTextEditor } from './edit-panel/GrammarTextEditor.js';
import { useEditorStore } from './EditorStoreProvider.js';

export const GrammarEditPanel = observer(() => {
  const editorStore = useEditorStore();
  const currentEditorState =
    editorStore.tabManagerState.currentTab instanceof GrammarTextEditorState
      ? editorStore.tabManagerState.currentTab
      : undefined;

  const renderActiveElementTab = (): React.ReactNode => {
    if (currentEditorState) {
      return (
        <GrammarTextEditor
          key={currentEditorState.uuid}
          grammarTextEditorState={currentEditorState}
        />
      );
    }
    return null;
  };

  const toggleWordWrap =
    (grammarTextEditorState: GrammarTextEditorState): React.MouseEventHandler =>
    (event): void =>
      grammarTextEditorState.setWrapText(!grammarTextEditorState.wrapText);

  const renderTab = (editorState: TabState): React.ReactNode | undefined =>
    editorState.label;

  if (!currentEditorState) {
    return <></>;
  }

  return (
    <div className="panel edit-panel">
      <ContextMenu disabled={true} className="panel__header edit-panel__header">
        <div className="edit-panel__header__tabs">
          <TabManager
            tabManagerState={editorStore.tabManagerState}
            tabRenderer={renderTab}
          />
        </div>
        <div className="edit-panel__header__actions">
          {editorStore.tabManagerState.currentTab instanceof
            GrammarTextEditorState && (
            <button
              className={clsx('edit-panel__header__action', {
                'edit-panel__header__action--active':
                  editorStore.tabManagerState.currentTab.wrapText,
              })}
              onClick={toggleWordWrap(editorStore.tabManagerState.currentTab)}
              tabIndex={-1}
              title={`[${
                editorStore.tabManagerState.currentTab.wrapText ? 'on' : 'off'
              }] Toggle word wrap`}
            >
              <WordWrapIcon className="edit-panel__icon__word-wrap" />
            </button>
          )}
        </div>
      </ContextMenu>
      <div
        key={currentEditorState.uuid}
        className="panel__content edit-panel__content"
      >
        {renderActiveElementTab()}
      </div>
    </div>
  );
});
