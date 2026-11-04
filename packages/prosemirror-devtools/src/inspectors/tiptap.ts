import { getExtensionField, type Editor } from "@tiptap/core";
import type { EditorState, PluginKey } from "prosemirror-state";

import { resolveInspectionLimits, serializeInspectionValue } from "../inspection/serialization";
import type {
  InspectionEvidence,
  InspectionLimits,
  ProseMirrorInspector,
} from "../inspection/types";
import type { SerializedValue } from "../core/types";

export interface TiptapPluginAssociation {
  readonly extensionName: string;
  readonly pluginKeys: readonly PluginKey[];
}

export interface TiptapInspectorOptions {
  readonly editor: Editor;
  /** Associations known by the extension author, never inferred from names or timing. */
  readonly pluginAssociations?: readonly TiptapPluginAssociation[];
  readonly limits?: Partial<InspectionLimits>;
}

export interface TiptapExtensionInspection {
  readonly name: string;
  readonly type: string;
  readonly priority: number;
  readonly options: InspectionEvidence<SerializedValue>;
  readonly storage: InspectionEvidence<SerializedValue>;
  readonly plugins:
    | { readonly kind: "unobserved"; readonly reason: string }
    | {
        readonly kind: "application-declared";
        readonly installedIndices: readonly number[];
        readonly missingKeys: number;
        readonly additionalGeneratedPlugins: "unobserved";
      };
}

export interface TiptapInspection {
  readonly sample: "query" | "dispatch";
  readonly sampledAt: number;
  readonly externalStorageChanges: "unobserved-between-samples";
  readonly extensions: readonly TiptapExtensionInspection[];
}

export function createTiptapInspector({
  editor,
  pluginAssociations = [],
  limits: requestedLimits,
}: TiptapInspectorOptions): ProseMirrorInspector<TiptapInspection> {
  const limits = resolveInspectionLimits(requestedLimits);
  const inspect = (
    state: EditorState,
    sample: TiptapInspection["sample"],
  ): InspectionEvidence<TiptapInspection> => {
    if (editor.isDestroyed)
      return { kind: "unsupported", reason: "The Tiptap editor is destroyed." };
    return {
      kind: "available",
      value: {
        sample,
        sampledAt: Date.now(),
        externalStorageChanges: "unobserved-between-samples",
        extensions: editor.extensionManager.extensions.map((extension) => {
          const association = pluginAssociations.find(
            (item) => item.extensionName === extension.name,
          );
          const installedIndices: number[] = [];
          let missingKeys = 0;
          for (const key of association?.pluginKeys ?? []) {
            const plugin = key.get(state);
            const index = plugin ? state.plugins.indexOf(plugin) : -1;
            if (index < 0) missingKeys += 1;
            else installedIndices.push(index);
          }
          return {
            name: extension.name,
            type: extension.type,
            priority: getExtensionField(extension, "priority") ?? 100,
            options: serializeInspectionValue(extension.options, limits),
            storage: serializeInspectionValue(Reflect.get(editor.storage, extension.name), limits),
            plugins: association
              ? {
                  kind: "application-declared",
                  installedIndices,
                  missingKeys,
                  additionalGeneratedPlugins: "unobserved",
                }
              : {
                  kind: "unobserved",
                  reason:
                    "No extension-to-plugin association was observed or supplied by the application.",
                },
          };
        }),
      },
    };
  };
  return {
    descriptor: {
      id: "tiptap",
      version: "1",
      label: "Tiptap extensions",
      description:
        "Active extensions, inherited priorities, bounded options and storage samples. Plugin associations require application knowledge. Storage changes between samples are unobserved.",
      prerequisites: [
        "A live Tiptap 3 editor",
        "Explicit plugin keys for known extension associations",
      ],
    },
    read: ({ state }) => inspect(state, "query"),
    capture: ({ stateAfter }) => inspect(stateAfter, "dispatch"),
  };
}
