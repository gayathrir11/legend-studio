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

import { useEffect, useState, useRef, useCallback, forwardRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  type IDisposable,
  editor as monacoEditorAPI,
  languages as monacoLanguagesAPI,
} from 'monaco-editor';
import {
  ContextMenu,
  clsx,
  WordWrapIcon,
  MoreHorizontalIcon,
  FoldIcon,
  UnfoldIcon,
  PanelContent,
  MenuContent,
  MenuContentItem,
} from '@finos/legend-art';
import {
  DEFAULT_TAB_SIZE,
  useApplicationStore,
  useApplicationNavigationContext,
  type DocumentationEntry,
} from '@finos/legend-application';
import {
  disposeCodeEditor,
  getBaseCodeEditorOptions,
  resetLineNumberGutterWidth,
  getCodeEditorValue,
  normalizeLineEnding,
  setWarningMarkers,
  clearMarkers,
  setErrorMarkers,
  moveCursorToPosition,
  CODE_EDITOR_THEME,
  CODE_EDITOR_LANGUAGE,
  getInlineSnippetSuggestions,
  type PureGrammarTextSuggestion,
  getParserKeywordSuggestions,
  getParserElementSnippetSuggestions,
  getSectionParserNameFromLineText,
} from '@finos/legend-lego/code-editor';
import {
  type ElementDragSource,
  CORE_DND_TYPE,
} from '../../../stores/editor/utils/DnDUtils.js';
import { useDrop } from 'react-dnd';
import type { DSL_LegendStudioApplicationPlugin_Extension } from '../../../stores/LegendStudioApplicationPlugin.js';
import { flowResult } from 'mobx';
import { useEditorStore } from '../EditorStoreProvider.js';
import { hasWhiteSpace, isNonNullable } from '@finos/legend-shared';
import {
  PARSER_SECTION_MARKER,
  PURE_CONNECTION_NAME,
  PURE_ELEMENT_NAME,
  PURE_PARSER,
} from '@finos/legend-graph';
import type { EditorStore } from '../../../stores/editor/EditorStore.js';
import { LEGEND_STUDIO_DOCUMENTATION_KEY } from '../../../__lib__/LegendStudioDocumentation.js';
import {
  BLANK_CLASS_SNIPPET,
  CLASS_WITH_CONSTRAINT_SNIPPET,
  CLASS_WITH_INHERITANCE_SNIPPET,
  CLASS_WITH_PROPERTY_SNIPPET,
  DATA_WITH_EXTERNAL_FORMAT_SNIPPET,
  DATA_WITH_MODEL_STORE_SNIPPET,
  createDataElementSnippetWithEmbeddedDataSuggestionSnippet,
  SIMPLE_PROFILE_SNIPPET,
  SIMPLE_ENUMERATION_SNIPPET,
  SIMPLE_ASSOCIATION_SNIPPET,
  SIMPLE_MEASURE_SNIPPET,
  BLANK_FUNCTION_SNIPPET,
  SIMPLE_FUNCTION_SNIPPET,
  SIMPLE_RUNTIME_SNIPPET,
  JSON_MODEL_CONNECTION_SNIPPET,
  XML_MODEL_CONNECTION_SNIPPET,
  MODEL_CHAIN_CONNECTION_SNIPPET,
  RELATIONAL_DATABASE_CONNECTION_SNIPPET,
  BLANK_RELATIONAL_DATABASE_SNIPPET,
  SIMPLE_GENERATION_SPECIFICATION_SNIPPET,
  BLANK_SERVICE_SNIPPET,
  SERVICE_WITH_SINGLE_EXECUTION_SNIPPET,
  SERVICE_WITH_MULTI_EXECUTION_SNIPPET,
  BLANK_MAPPING_SNIPPET,
  MAPPING_WITH_M2M_CLASS_MAPPING_SNIPPET,
  MAPPING_WITH_ENUMERATION_MAPPING_SNIPPET,
  MAPPING_WITH_RELATIONAL_CLASS_MAPPING_SNIPPET,
  POST_PROCESSOR_RELATIONAL_DATABASE_CONNECTION_SNIPPET,
  createConnectionSnippetWithPostProcessorSuggestionSnippet,
} from '../../../__lib__/LegendStudioCodeSnippet.js';
import type { DSL_Data_LegendStudioApplicationPlugin_Extension } from '../../../stores/extensions/DSL_Data_LegendStudioApplicationPlugin_Extension.js';
import { LEGEND_STUDIO_APPLICATION_NAVIGATION_CONTEXT_KEY } from '../../../__lib__/LegendStudioApplicationNavigationContext.js';
import type { DSL_Mapping_LegendStudioApplicationPlugin_Extension } from '../../../stores/extensions/DSL_Mapping_LegendStudioApplicationPlugin_Extension.js';
import type { STO_Relational_LegendStudioApplicationPlugin_Extension } from '../../../stores/extensions/STO_Relational_LegendStudioApplicationPlugin_Extension.js';
import { LEGEND_STUDIO_SETTING_KEY } from '../../../__lib__/LegendStudioSetting.js';
import { GraphEditGrammarModeState } from '../../../stores/editor/GraphEditGrammarModeState.js';

export const GrammarTextEditorHeaderTabContextMenu = observer(
  forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
    function GrammarTextEditorHeaderTabContextMenu(props, ref) {
      const editorStore = useEditorStore();
      const applicationStore = useApplicationStore();
      const leaveTextMode = applicationStore.guardUnhandledError(() =>
        flowResult(editorStore.toggleTextMode()),
      );

      return (
        <MenuContent ref={ref}>
          <MenuContentItem onClick={leaveTextMode}>
            Leave Text Mode
          </MenuContentItem>
        </MenuContent>
      );
    },
  ),
);

const getParserDocumetation = (
  editorStore: EditorStore,
  parserKeyword: string,
): DocumentationEntry | undefined => {
  switch (parserKeyword) {
    case PURE_PARSER.PURE: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_PURE,
      );
    }
    case PURE_PARSER.MAPPING: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_MAPPING,
      );
    }
    case PURE_PARSER.CONNECTION: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_CONNECTION,
      );
    }
    case PURE_PARSER.RUNTIME: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_RUNTIME,
      );
    }
    case PURE_PARSER.SERVICE: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_SERVICE,
      );
    }
    case PURE_PARSER.RELATIONAL: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_RELATIONAL,
      );
    }
    case PURE_PARSER.FILE_GENERATION_SPECIFICATION: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_FILE_GENERATION,
      );
    }
    case PURE_PARSER.GENERATION_SPECIFICATION: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_GENERATION_SPECIFICATION,
      );
    }
    case PURE_PARSER.DATA: {
      return editorStore.applicationStore.documentationService.getDocEntry(
        LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_DATA,
      );
    }
    default: {
      const parserDocumentationGetters = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_LegendStudioApplicationPlugin_Extension
            ).getExtraPureGrammarParserDocumentationGetters?.() ?? [],
        );
      for (const docGetter of parserDocumentationGetters) {
        const doc = docGetter(editorStore, parserKeyword);
        if (doc) {
          return doc;
        }
      }
    }
  }
  return undefined;
};

const getParserElementDocumentation = (
  editorStore: EditorStore,
  parserKeyword: string,
  elementKeyword: string,
): DocumentationEntry | undefined => {
  switch (parserKeyword) {
    case PURE_PARSER.PURE: {
      if (elementKeyword === PURE_ELEMENT_NAME.CLASS) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_CLASS,
        );
      } else if (elementKeyword === PURE_ELEMENT_NAME.PROFILE) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_PROFILE,
        );
      } else if (elementKeyword === PURE_ELEMENT_NAME.ENUMERATION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_ENUMERATION,
        );
      } else if (elementKeyword === PURE_ELEMENT_NAME.MEASURE) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_MEASURE,
        );
      } else if (elementKeyword === PURE_ELEMENT_NAME.ASSOCIATION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_ASSOCIATION,
        );
      } else if (elementKeyword === PURE_ELEMENT_NAME.FUNCTION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_FUNCTION,
        );
      }
      return undefined;
    }
    case PURE_PARSER.MAPPING: {
      if (elementKeyword === PURE_ELEMENT_NAME.MAPPING) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_MAPPING,
        );
      }
      return undefined;
    }
    case PURE_PARSER.CONNECTION: {
      if (elementKeyword === PURE_CONNECTION_NAME.JSON_MODEL_CONNECTION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_CONNECTION_JSON_MODEL_CONNECTION,
        );
      } else if (elementKeyword === PURE_CONNECTION_NAME.XML_MODEL_CONNECTION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_CONNECTION_XML_MODEL_CONNECTION,
        );
      } else if (
        elementKeyword === PURE_CONNECTION_NAME.MODEL_CHAIN_CONNECTION
      ) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_CONNECTION_MODEL_CHAIN_CONNECTION,
        );
      } else if (
        elementKeyword === PURE_CONNECTION_NAME.RELATIONAL_DATABASE_CONNECTION
      ) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_CONNECTION_RELATIONAL_DATABASE_CONNECTION,
        );
      }
      // TODO: introduce extension mechanism
      return undefined;
    }
    case PURE_PARSER.RUNTIME: {
      if (elementKeyword === PURE_ELEMENT_NAME.RUNTIME) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_RUNTIME,
        );
      }
      return undefined;
    }
    case PURE_PARSER.SERVICE: {
      if (elementKeyword === PURE_ELEMENT_NAME.SERVICE) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_SERVICE,
        );
      }
      return undefined;
    }
    case PURE_PARSER.RELATIONAL: {
      if (elementKeyword === PURE_ELEMENT_NAME.DATABASE) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_DATABASE,
        );
      }
      return undefined;
    }
    case PURE_PARSER.FILE_GENERATION_SPECIFICATION: {
      if (elementKeyword === PURE_ELEMENT_NAME.FILE_GENERATION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_FILE_GENERATION_SPECIFICATION,
        );
      }
      return undefined;
    }
    case PURE_PARSER.GENERATION_SPECIFICATION: {
      if (elementKeyword === PURE_ELEMENT_NAME.GENERATION_SPECIFICATION) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.CONCEPT_ELEMENT_GENERATION_SPECIFICATION,
        );
      }
      return undefined;
    }
    case PURE_PARSER.DATA: {
      if (elementKeyword === PURE_ELEMENT_NAME.DATA_ELEMENT) {
        return editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_DATA,
        );
      }
      return undefined;
    }
    default: {
      const parserElementDocumentationGetters = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_LegendStudioApplicationPlugin_Extension
            ).getExtraPureGrammarParserElementDocumentationGetters?.() ?? [],
        );
      for (const docGetter of parserElementDocumentationGetters) {
        const doc = docGetter(editorStore, parserKeyword, elementKeyword);
        if (doc) {
          return doc;
        }
      }
    }
  }
  return undefined;
};

const collectParserKeywordSuggestions = (
  editorStore: EditorStore,
): PureGrammarTextSuggestion[] => {
  const parserKeywordSuggestions = editorStore.pluginManager
    .getApplicationPlugins()
    .flatMap(
      (plugin) =>
        (
          plugin as DSL_LegendStudioApplicationPlugin_Extension
        ).getExtraPureGrammarParserKeywordSuggestionGetters?.() ?? [],
    )
    .flatMap((suggestionGetter) => suggestionGetter(editorStore));
  return [
    {
      text: PURE_PARSER.PURE,
      description: `(core Pure)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_PURE,
        ),
      insertText: PURE_PARSER.PURE,
    },
    {
      text: PURE_PARSER.MAPPING,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_MAPPING,
        ),
      insertText: PURE_PARSER.MAPPING,
    },
    {
      text: PURE_PARSER.CONNECTION,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_CONNECTION,
        ),
      insertText: PURE_PARSER.CONNECTION,
    },
    {
      text: PURE_PARSER.RUNTIME,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_RUNTIME,
        ),
      insertText: PURE_PARSER.RUNTIME,
    },
    {
      text: PURE_PARSER.RELATIONAL,
      description: `(external store)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_RELATIONAL,
        ),
      insertText: PURE_PARSER.RELATIONAL,
    },
    {
      text: PURE_PARSER.SERVICE,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_SERVICE,
        ),
      insertText: PURE_PARSER.SERVICE,
    },
    {
      text: PURE_PARSER.GENERATION_SPECIFICATION,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_GENERATION_SPECIFICATION,
        ),
      insertText: PURE_PARSER.GENERATION_SPECIFICATION,
    },
    {
      text: PURE_PARSER.FILE_GENERATION_SPECIFICATION,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_FILE_GENERATION,
        ),
      insertText: PURE_PARSER.FILE_GENERATION_SPECIFICATION,
    },
    {
      text: PURE_PARSER.DATA,
      description: `(dsl)`,
      documentation:
        editorStore.applicationStore.documentationService.getDocEntry(
          LEGEND_STUDIO_DOCUMENTATION_KEY.GRAMMAR_PARSER_DATA,
        ),
      insertText: PURE_PARSER.DATA,
    },
    ...parserKeywordSuggestions,
  ];
};

const collectParserElementSnippetSuggestions = (
  editorStore: EditorStore,
  parserKeyword: string,
): PureGrammarTextSuggestion[] => {
  switch (parserKeyword) {
    case PURE_PARSER.PURE: {
      return [
        // class
        {
          text: PURE_ELEMENT_NAME.CLASS,
          description: '(blank)',
          insertText: BLANK_CLASS_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.CLASS,
          description: 'with property',
          insertText: CLASS_WITH_PROPERTY_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.CLASS,
          description: 'with inheritance',
          insertText: CLASS_WITH_INHERITANCE_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.CLASS,
          description: 'with constraint',
          insertText: CLASS_WITH_CONSTRAINT_SNIPPET,
        },
        // profile
        {
          text: PURE_ELEMENT_NAME.PROFILE,
          insertText: SIMPLE_PROFILE_SNIPPET,
        },
        // enumeration
        {
          text: PURE_ELEMENT_NAME.ENUMERATION,
          insertText: SIMPLE_ENUMERATION_SNIPPET,
        },
        // association
        {
          text: PURE_ELEMENT_NAME.ASSOCIATION,
          insertText: SIMPLE_ASSOCIATION_SNIPPET,
        },
        // measure
        {
          text: PURE_ELEMENT_NAME.MEASURE,
          insertText: SIMPLE_MEASURE_SNIPPET,
        },
        // function
        {
          text: PURE_ELEMENT_NAME.FUNCTION,
          description: '(blank)',
          insertText: BLANK_FUNCTION_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.FUNCTION,
          insertText: SIMPLE_FUNCTION_SNIPPET,
        },
      ];
    }
    case PURE_PARSER.MAPPING: {
      return [
        {
          text: PURE_ELEMENT_NAME.MAPPING,
          description: '(blank)',
          insertText: BLANK_MAPPING_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.MAPPING,
          description: 'with model-to-model mapping',
          insertText: MAPPING_WITH_M2M_CLASS_MAPPING_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.MAPPING,
          description: 'with relational mapping',
          insertText: MAPPING_WITH_RELATIONAL_CLASS_MAPPING_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.MAPPING,
          description: 'with enumeration mapping',
          insertText: MAPPING_WITH_ENUMERATION_MAPPING_SNIPPET,
        },
      ];
    }
    case PURE_PARSER.CONNECTION: {
      const embeddedPostProcessorSnippetSuggestions = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as STO_Relational_LegendStudioApplicationPlugin_Extension
            ).getExtraPostProcessorSnippetSuggestions?.() ?? [],
        );
      const connectionSnippetSuggestions = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_Mapping_LegendStudioApplicationPlugin_Extension
            ).getExtraNewConnectionSnippetSuggestions?.() ?? [],
        );
      return [
        {
          text: PURE_CONNECTION_NAME.JSON_MODEL_CONNECTION,
          description: 'JSON model connection',
          insertText: JSON_MODEL_CONNECTION_SNIPPET,
        },
        {
          text: PURE_CONNECTION_NAME.XML_MODEL_CONNECTION,
          description: 'XML model connection',
          insertText: XML_MODEL_CONNECTION_SNIPPET,
        },
        {
          text: PURE_CONNECTION_NAME.MODEL_CHAIN_CONNECTION,
          description: 'model chain connection',
          insertText: MODEL_CHAIN_CONNECTION_SNIPPET,
        },
        {
          text: PURE_CONNECTION_NAME.RELATIONAL_DATABASE_CONNECTION,
          description: 'relational database connection',
          insertText: RELATIONAL_DATABASE_CONNECTION_SNIPPET,
        },
        {
          text: PURE_CONNECTION_NAME.RELATIONAL_DATABASE_CONNECTION,
          description: 'relational database connection with post-processor',
          insertText: POST_PROCESSOR_RELATIONAL_DATABASE_CONNECTION_SNIPPET,
        },
        ...connectionSnippetSuggestions.map((suggestion) => ({
          text: suggestion.text,
          description: suggestion.description,
          insertText: suggestion.insertText,
        })),
        ...embeddedPostProcessorSnippetSuggestions.map((suggestion) => ({
          text: PURE_CONNECTION_NAME.RELATIONAL_DATABASE_CONNECTION,
          description: suggestion.description,
          insertText: createConnectionSnippetWithPostProcessorSuggestionSnippet(
            suggestion.text,
          ),
        })),
      ];
    }
    case PURE_PARSER.RUNTIME: {
      return [
        {
          text: PURE_ELEMENT_NAME.RUNTIME,
          insertText: SIMPLE_RUNTIME_SNIPPET,
        },
      ];
    }
    case PURE_PARSER.SERVICE: {
      return [
        {
          text: PURE_ELEMENT_NAME.SERVICE,
          description: '(blank)',
          insertText: BLANK_SERVICE_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.SERVICE,
          description: 'with single execution',
          insertText: SERVICE_WITH_SINGLE_EXECUTION_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.SERVICE,
          description: 'with multi execution',
          insertText: SERVICE_WITH_MULTI_EXECUTION_SNIPPET,
        },
      ];
    }
    case PURE_PARSER.RELATIONAL: {
      return [
        {
          text: PURE_ELEMENT_NAME.DATABASE,
          description: '(blank)',
          insertText: BLANK_RELATIONAL_DATABASE_SNIPPET,
        },
      ];
    }
    case PURE_PARSER.FILE_GENERATION_SPECIFICATION: {
      return [
        // TODO?: add extension mechanism for suggestion for different file generations
      ];
    }
    case PURE_PARSER.GENERATION_SPECIFICATION: {
      return [
        {
          text: PURE_ELEMENT_NAME.GENERATION_SPECIFICATION,
          description: '(blank)',
          insertText: SIMPLE_GENERATION_SPECIFICATION_SNIPPET,
        },
      ];
    }
    case PURE_PARSER.DATA: {
      const embeddedDateSnippetSuggestions = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_Data_LegendStudioApplicationPlugin_Extension
            ).getExtraEmbeddedDataSnippetSuggestions?.() ?? [],
        );
      return [
        {
          text: PURE_ELEMENT_NAME.DATA_ELEMENT,
          description: 'with external format',
          insertText: DATA_WITH_EXTERNAL_FORMAT_SNIPPET,
        },
        {
          text: PURE_ELEMENT_NAME.DATA_ELEMENT,
          description: 'using model store',
          insertText: DATA_WITH_MODEL_STORE_SNIPPET,
        },
        ...embeddedDateSnippetSuggestions.map((suggestion) => ({
          text: PURE_ELEMENT_NAME.DATA_ELEMENT,
          description: suggestion.description,
          insertText: createDataElementSnippetWithEmbeddedDataSuggestionSnippet(
            suggestion.text,
          ),
        })),
      ];
    }
    default: {
      const parserElementSnippetSuggestionsGetters = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_LegendStudioApplicationPlugin_Extension
            ).getExtraPureGrammarParserElementSnippetSuggestionsGetters?.() ??
            [],
        );
      for (const snippetSuggestionsGetter of parserElementSnippetSuggestionsGetters) {
        const snippetSuggestions = snippetSuggestionsGetter(
          editorStore,
          parserKeyword,
        );
        if (snippetSuggestions) {
          return snippetSuggestions;
        }
      }
    }
  }
  return [];
};

export const GrammarTextEditor = observer(() => {
  const [editor, setEditor] = useState<
    monacoEditorAPI.IStandaloneCodeEditor | undefined
  >();
  const editorStore = useEditorStore();
  const applicationStore = useApplicationStore();
  const grammarTextEditorState = editorStore.getGraphEditorMode(
    GraphEditGrammarModeState,
  ).grammarTextEditorState;
  const error = editorStore.graphState.error;
  const [elementsFolded, setFoldingElements] = useState(false);

  const forcedCursorPosition = grammarTextEditorState.forcedCursorPosition;
  const value = normalizeLineEnding(grammarTextEditorState.graphGrammarText);
  const textEditorRef = useRef<HTMLDivElement>(null);
  const hoverProviderDisposer = useRef<IDisposable | undefined>(undefined);
  const suggestionProviderDisposer = useRef<IDisposable | undefined>(undefined);

  const leaveTextMode = applicationStore.guardUnhandledError(() =>
    flowResult(editorStore.toggleTextMode()),
  );

  const toggleWordWrap = (): void => {
    grammarTextEditorState.setWrapText(!grammarTextEditorState.wrapText);
    editorStore.applicationStore.settingService.persistValue(
      LEGEND_STUDIO_SETTING_KEY.EDITOR_WRAP_TEXT,
      grammarTextEditorState.wrapText,
    );
  };

  useEffect(() => {
    if (!editor && textEditorRef.current) {
      const element = textEditorRef.current;
      const _editor = monacoEditorAPI.create(element, {
        ...getBaseCodeEditorOptions(),
        language: CODE_EDITOR_LANGUAGE.PURE,
        theme: CODE_EDITOR_THEME.DEFAULT_DARK,
        renderValidationDecorations: 'on',
      });
      _editor.onDidChangeModelContent(() => {
        grammarTextEditorState.setGraphGrammarText(getCodeEditorValue(_editor));
        clearMarkers();
        // NOTE: we can technically can reset the current element label regex string here
        // but if we do that on first load, the cursor will not jump to the current element
        // also, it's better to place that logic in an effect that watches for the regex string
      });
      _editor.focus(); // focus on the editor initially
      setEditor(_editor);
    }
  }, [editorStore, applicationStore, editor, grammarTextEditorState]);

  // Drag and Drop
  const extraElementDragTypes = editorStore.pluginManager
    .getApplicationPlugins()
    .flatMap(
      (plugin) =>
        (
          plugin as DSL_LegendStudioApplicationPlugin_Extension
        ).getExtraPureGrammarTextEditorDragElementTypes?.() ?? [],
    );
  const handleDrop = useCallback(
    (item: ElementDragSource): void => {
      if (editor) {
        editor.trigger('keyboard', 'type', {
          text: item.data.packageableElement.path,
        });
      }
    },
    [editor],
  );
  const [, dropConnector] = useDrop<ElementDragSource>(
    () => ({
      accept: [
        ...extraElementDragTypes,
        CORE_DND_TYPE.PROJECT_EXPLORER_PACKAGE,
        CORE_DND_TYPE.PROJECT_EXPLORER_CLASS,
        CORE_DND_TYPE.PROJECT_EXPLORER_ASSOCIATION,
        CORE_DND_TYPE.PROJECT_EXPLORER_MEASURE,
        CORE_DND_TYPE.PROJECT_EXPLORER_ENUMERATION,
        CORE_DND_TYPE.PROJECT_EXPLORER_PROFILE,
        CORE_DND_TYPE.PROJECT_EXPLORER_FUNCTION,
        CORE_DND_TYPE.PROJECT_EXPLORER_FLAT_DATA,
        CORE_DND_TYPE.PROJECT_EXPLORER_DATABASE,
        CORE_DND_TYPE.PROJECT_EXPLORER_MAPPING,
        CORE_DND_TYPE.PROJECT_EXPLORER_SERVICE,
        CORE_DND_TYPE.PROJECT_EXPLORER_CONNECTION,
        CORE_DND_TYPE.PROJECT_EXPLORER_RUNTIME,
        CORE_DND_TYPE.PROJECT_EXPLORER_FILE_GENERATION,
        CORE_DND_TYPE.PROJECT_EXPLORER_GENERATION_TREE,
        CORE_DND_TYPE.PROJECT_EXPLORER_DATA,
      ],

      drop: (item) => handleDrop(item),
    }),
    [extraElementDragTypes, handleDrop],
  );
  dropConnector(textEditorRef);

  if (editor) {
    // Set the value of the editor
    const currentValue = getCodeEditorValue(editor);
    if (currentValue !== value) {
      editor.setValue(value);
    }
    editor.updateOptions({
      wordWrap: grammarTextEditorState.wrapText ? 'on' : 'off',
    });
    resetLineNumberGutterWidth(editor);
    const editorModel = editor.getModel();
    if (editorModel) {
      editorModel.updateOptions({ tabSize: DEFAULT_TAB_SIZE });
      if (
        !editorStore.graphState.areProblemsStale &&
        error?.sourceInformation
      ) {
        setErrorMarkers(editorModel, [
          {
            message: error.message,
            startLineNumber: error.sourceInformation.startLine,
            startColumn: error.sourceInformation.startColumn,
            endLineNumber: error.sourceInformation.endLine,
            endColumn: error.sourceInformation.endColumn,
          },
        ]);
      }

      if (
        !editorStore.graphState.areProblemsStale &&
        editorStore.graphState.warnings.length
      ) {
        setWarningMarkers(
          editorModel,
          editorStore.graphState.warnings
            .map((warning) => {
              if (!warning.sourceInformation) {
                return undefined;
              }
              return {
                message: warning.message,
                startLineNumber: warning.sourceInformation.startLine,
                startColumn: warning.sourceInformation.startColumn,
                endLineNumber: warning.sourceInformation.endLine,
                endColumn: warning.sourceInformation.endColumn,
              };
            })
            .filter(isNonNullable),
        );
      }
    }
    // Disable editing if user is in viewer mode
    editor.updateOptions({ readOnly: editorStore.editorMode.disableEditing });

    // hover
    hoverProviderDisposer.current?.dispose();
    hoverProviderDisposer.current = monacoLanguagesAPI.registerHoverProvider(
      CODE_EDITOR_LANGUAGE.PURE,
      {
        provideHover: (model, position) => {
          const currentWord = model.getWordAtPosition(position);
          if (!currentWord) {
            return { contents: [] };
          }

          // show documention for parser section
          const lineTextIncludingWordRange = {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: currentWord.endColumn,
          };
          const lineTextIncludingWord = model.getValueInRange(
            lineTextIncludingWordRange,
          );
          // NOTE: we don't need to trim here since the leading whitespace in front of
          // the section header is considered invalid syntax in the grammar
          if (
            !hasWhiteSpace(lineTextIncludingWord) &&
            lineTextIncludingWord.startsWith(PARSER_SECTION_MARKER)
          ) {
            const parserKeyword = lineTextIncludingWord.substring(
              PARSER_SECTION_MARKER.length,
            );
            const doc = getParserDocumetation(editorStore, parserKeyword);
            if (doc) {
              return {
                range: lineTextIncludingWordRange,
                contents: [
                  doc.markdownText
                    ? {
                        value: doc.markdownText.value,
                      }
                    : undefined,
                  doc.url
                    ? {
                        value: `[See documentation](${doc.url})`,
                      }
                    : undefined,
                ].filter(isNonNullable),
              };
            }
          }

          // show documentation for parser element
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          const allParserSectionHeaders =
            // NOTE: since `###Pure` is implicitly considered as the first section, we prepend it to the text
            `${PARSER_SECTION_MARKER}${PURE_PARSER.PURE}\n${textUntilPosition}`
              .split('\n')
              .filter((line) => line.startsWith(PARSER_SECTION_MARKER));
          const currentSectionParserKeyword = getSectionParserNameFromLineText(
            allParserSectionHeaders[allParserSectionHeaders.length - 1] ?? '',
          );
          if (currentSectionParserKeyword) {
            const doc = getParserElementDocumentation(
              editorStore,
              currentSectionParserKeyword,
              currentWord.word,
            );
            if (doc) {
              return {
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: currentWord.startColumn,
                  endLineNumber: position.lineNumber,
                  endColumn: currentWord.endColumn,
                },
                contents: [
                  doc.markdownText
                    ? {
                        value: doc.markdownText.value,
                      }
                    : undefined,
                  doc.url
                    ? {
                        value: `[See documentation](${doc.url})`,
                      }
                    : undefined,
                ].filter(isNonNullable),
              };
            }
          }

          return { contents: [] };
        },
      },
    );

    // suggestion
    suggestionProviderDisposer.current?.dispose();
    suggestionProviderDisposer.current =
      monacoLanguagesAPI.registerCompletionItemProvider(
        CODE_EDITOR_LANGUAGE.PURE,
        {
          // NOTE: we need to specify this to show suggestions for section
          // because by default, only alphanumeric characters trigger completion item provider
          // See https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionContext.html#triggerCharacter
          // See https://github.com/microsoft/monaco-editor/issues/2530#issuecomment-861757198
          triggerCharacters: ['#'],
          provideCompletionItems: (model, position) => {
            let suggestions: monacoLanguagesAPI.CompletionItem[] = [];

            // suggestions for parser keyword
            suggestions = suggestions.concat(
              getParserKeywordSuggestions(
                position,
                model,
                collectParserKeywordSuggestions(editorStore),
              ),
            );

            // suggestions for parser element snippets
            suggestions = suggestions.concat(
              getParserElementSnippetSuggestions(
                position,
                model,
                (parserName: string) =>
                  collectParserElementSnippetSuggestions(
                    editorStore,
                    parserName,
                  ),
              ),
            );

            // inline code snippet suggestions
            suggestions = suggestions.concat(
              getInlineSnippetSuggestions(position, model),
            );

            return { suggestions };
          },
        },
      );
  }

  function toggleAutoFoldingElements(): void {
    const autoFoldingElements = editorStore.pluginManager
      .getApplicationPlugins()
      .flatMap(
        (plugin) =>
          (
            plugin as DSL_LegendStudioApplicationPlugin_Extension
          ).getExtraGrammarTextEditorAutoFoldingElementCreatorKeywords?.() ??
          [],
      );
    const foldingClass = editor?.getContribution('editor.contrib.folding');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (foldingClass as any).getFoldingModel().then(
      (foldingModel: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _regions: any;
        onDidChange: (arg0: () => void) => void;
        getRegionAtLine: (arg0: unknown) => unknown;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getAllRegionsAtLine(arg0: unknown): any;
        toggleCollapseState: (arg0: unknown) => unknown;
      }) => {
        const model = editor?.getModel();
        const toggleFoldingLines: number[] = [];
        model?.getLinesContent().forEach((line, j) => {
          autoFoldingElements.forEach((elementName) => {
            if (line.match(new RegExp(`^${elementName}`))) {
              toggleFoldingLines.push(j + 2);
            }
          });
        });
        let allElementsFolded = true;
        toggleFoldingLines.forEach((foldingLineRegion, i) => {
          if (foldingModel.getAllRegionsAtLine(foldingLineRegion)[0]) {
            if (
              foldingModel._regions.isCollapsed(
                foldingModel.getAllRegionsAtLine(foldingLineRegion)[0]
                  .regionIndex,
              ) === false
            ) {
              allElementsFolded = false;
            }
          }
        });

        setFoldingElements(!allElementsFolded);

        toggleFoldingLines.forEach((foldingLineRegion, i) => {
          if (foldingModel.getAllRegionsAtLine(foldingLineRegion)[0]) {
            if (
              foldingModel._regions.isCollapsed(
                foldingModel.getAllRegionsAtLine(foldingLineRegion)[0]
                  .regionIndex,
              ) !== elementsFolded
            ) {
              foldingModel.toggleCollapseState(
                foldingModel.getAllRegionsAtLine(foldingLineRegion),
              );
            }
          }
        });
      },
    );
  }

  useEffect(() => {
    if (editor && forcedCursorPosition) {
      moveCursorToPosition(editor, forcedCursorPosition);
    }
  }, [editor, forcedCursorPosition]);

  useEffect(() => {
    if (editor) {
      const autoFoldingElements = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_LegendStudioApplicationPlugin_Extension
            ).getExtraGrammarTextEditorAutoFoldingElementCreatorKeywords?.() ??
            [],
        );
      const foldingClass = editor.getContribution('editor.contrib.folding');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (foldingClass as any).getFoldingModel().then(
        (foldingModel: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          _regions: any;
          onDidChange: (arg0: () => void) => void;
          getRegionAtLine: (arg0: unknown) => unknown;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getAllRegionsAtLine(arg0: unknown): any;
          toggleCollapseState: (arg0: unknown) => unknown;
        }) => {
          foldingModel.onDidChange(() => {
            const model = editor.getModel();
            const toggleFoldingLines: number[] = [];
            model?.getLinesContent().forEach((line, j) => {
              autoFoldingElements.forEach((elementName) => {
                if (line.match(new RegExp(`^${elementName}`))) {
                  toggleFoldingLines.push(j + 2);
                }
              });
            });
            let allElementsFolded = true;
            toggleFoldingLines.forEach((foldingLineRegion, i) => {
              if (foldingModel.getAllRegionsAtLine(foldingLineRegion)[0]) {
                if (
                  foldingModel._regions.isCollapsed(
                    foldingModel.getAllRegionsAtLine(foldingLineRegion)[0]
                      .regionIndex,
                  ) === false
                ) {
                  allElementsFolded = false;
                }
              }
            });

            setFoldingElements(!allElementsFolded);
          });
        },
      );
    }
  });

  useEffect(() => {
    if (editor) {
      const autoFoldingElements = editorStore.pluginManager
        .getApplicationPlugins()
        .flatMap(
          (plugin) =>
            (
              plugin as DSL_LegendStudioApplicationPlugin_Extension
            ).getExtraGrammarTextEditorAutoFoldingElementCreatorKeywords?.() ??
            [],
        );
      const foldingClass = editor.getContribution('editor.contrib.folding');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (foldingClass as any)
        .getFoldingModel()
        .then(
          (foldingModel: {
            onDidChange: (arg0: () => void) => void;
            getRegionAtLine: (arg0: unknown) => unknown;
            getAllRegionsAtLine(arg0: unknown): unknown;
            toggleCollapseState: (arg0: unknown) => unknown;
          }) => {
            const model = editor.getModel();
            const foldingLines: number[] = [];
            model?.getLinesContent().forEach((line, j) => {
              autoFoldingElements.forEach((elementName) => {
                if (line.match(new RegExp(`^${elementName}`))) {
                  foldingLines.push(j + 2);
                }
              });
            });
            foldingLines.forEach((foldingLineRegion, i) => {
              foldingModel.toggleCollapseState(
                foldingModel.getAllRegionsAtLine(foldingLineRegion),
              );
            });
          },
        );
    }
  }, [editor, editorStore.pluginManager]);

  // NOTE: dispose the editor to prevent potential memory-leak
  useEffect(
    () => (): void => {
      if (editor) {
        disposeCodeEditor(editor);
      }

      // Dispose the providers properly to avoid ending up with duplicated suggestions
      hoverProviderDisposer.current?.dispose();
      suggestionProviderDisposer.current?.dispose();
    },
    [editor],
  );

  useApplicationNavigationContext(
    LEGEND_STUDIO_APPLICATION_NAVIGATION_CONTEXT_KEY.TEXT_MODE_EDITOR,
  );

  return (
    <div className="panel editor-group">
      <div className="panel__header editor-group__header">
        <div className="editor-group__header__tabs">
          <div className="editor-group__text-mode__tab">
            <button
              className="editor-group__text-mode__tab__label"
              disabled={
                editorStore.graphState.isApplicationLeavingGraphEditMode
              }
              onClick={leaveTextMode}
              tabIndex={-1}
              title="Click to exit text mode and go back to form mode"
            >
              <MoreHorizontalIcon />
            </button>
          </div>
          <ContextMenu
            className="editor-group__text-mode__tab editor-group__text-mode__tab--active"
            content={<GrammarTextEditorHeaderTabContextMenu />}
          >
            <div className="editor-group__text-mode__tab__label">Text Mode</div>
          </ContextMenu>
        </div>
        <div className="editor-group__header__actions">
          <button
            className={clsx('editor-group__header__action', {
              'editor-group__header__action--active':
                grammarTextEditorState.wrapText,
            })}
            onClick={toggleWordWrap}
            tabIndex={-1}
            title={`[${
              grammarTextEditorState.wrapText ? 'on' : 'off'
            }] Toggle word wrap`}
          >
            <WordWrapIcon className="editor-group__icon__word-wrap" />
          </button>
          <button
            className={clsx('editor-group__header__action', {
              'editor-group__header__action--active': elementsFolded,
            })}
            onClick={toggleAutoFoldingElements}
            tabIndex={-1}
            title={`${
              !elementsFolded ? 'Unfold' : 'Fold'
            } auto-folding elements`}
          >
            {!elementsFolded && (
              <UnfoldIcon className="editor-group__icon__word-wrap" />
            )}
            {elementsFolded && (
              <FoldIcon className="editor-group__icon__word-wrap" />
            )}
          </button>
        </div>
      </div>
      <PanelContent className="editor-group__content">
        <div className="code-editor__container">
          <div className="code-editor__body" ref={textEditorRef} />
        </div>
      </PanelContent>
    </div>
  );
});
