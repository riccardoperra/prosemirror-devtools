import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TanStackDevtools, type TanStackDevtoolsAngularPlugin } from "@tanstack/angular-devtools";
import { createPlaygroundExtension } from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/angular";
import { ProseMirrorEditor } from "./prosemirror-editor";

const prosemirrorPlugin = createProseMirrorDevtoolsPlugin({
  defaultPanel: "playground-integration",
  extensions: [createPlaygroundExtension("Angular")],
  store: prosemirrorDevtoolsStore,
}) as unknown as TanStackDevtoolsAngularPlugin;

@Component({
  selector: "app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProseMirrorEditor, TanStackDevtools],
  templateUrl: "./app.html",
})
export class App {
  protected readonly latencyEnabled = signal(false);
  protected readonly devtoolsConfig = {
    position: "bottom-right" as const,
    hideUntilHover: false,
    openHotkey: ["CtrlOrMeta", "Shift", "D"],
  };
  protected readonly devtoolsPlugins = [prosemirrorPlugin];

  protected toggleLatency(event: Event): void {
    this.latencyEnabled.set((event.currentTarget as HTMLInputElement).checked);
  }
}
