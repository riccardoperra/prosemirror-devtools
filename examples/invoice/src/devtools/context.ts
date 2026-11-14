import type { Editor } from "@tiptap/core";
import { createContext, useContext } from "react";

/** What the lazily loaded devtools shell offers the app. Null when diagnostics are off. */
export interface DevtoolsActions {
  /** Calls the inspection tools through the Chrome DevTools MCP discovery event, as an agent would. */
  askAgent(): Promise<boolean>;
  /** Saves a Snapshots-panel snapshot of the current document under a name. */
  takeSnapshot(editor: Editor, name: string): void;
  /** Exports the latest dispatches, downloads the JSON, and returns whether it worked. */
  exportRecording(): boolean;
  /** Opens the read-only viewer on a recording file. */
  openRecording(file: File): Promise<void>;
  /** Exports and opens the viewer on the result, without a download. */
  previewRecording(): boolean;
}

export const DevtoolsContext = createContext<DevtoolsActions | null>(null);

export function useDevtools(): DevtoolsActions | null {
  return useContext(DevtoolsContext);
}
