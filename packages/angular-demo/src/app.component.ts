import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, signal } from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { TanStackDevtools, type TanStackDevtoolsAngularPlugin } from "@tanstack/angular-devtools";
import {
  createPlaygroundExtension,
  mountDemoEditor,
  type DemoEditorController,
} from "@prosemirror-devtools/demo-kit";
import { prosemirrorDevtoolsStore } from "prosemirror-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/angular";

@Component({
  selector: "app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TanStackDevtools],
  template: `
    <main class="playground">
      <header class="playground-header">
        <h1>ProseMirror + Angular playground</h1>
        <span class="devtools-shortcut">Devtools <kbd>⌘⇧D</kbd></span>
      </header>
      <section class="editor-workspace" aria-label="ProseMirror editor playground">
        <div class="plugin-bar">
          <div class="plugin-list">
            <span>plugins:</span><code>history · keymap · wordCount</code>
          </div>
          <label class="plugin-toggle"
            ><input [checked]="latencyEnabled()" (change)="toggleLatency($event)" type="checkbox" />
            slow apply</label
          >
        </div>
        <div #editorHost></div>
      </section>
      <tanstack-devtools [config]="config" [plugins]="plugins" />
    </main>
  `,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild("editorHost", { static: true }) private editorHost!: ElementRef<HTMLElement>;

  protected readonly latencyEnabled = signal(false);
  protected readonly config = {
    position: "bottom-right" as const,
    hideUntilHover: false,
    openHotkey: ["CtrlOrMeta", "Shift", "D"],
  };
  protected readonly plugins = [
    createProseMirrorDevtoolsPlugin({
      defaultPanel: "playground-integration",
      extensions: [createPlaygroundExtension("Angular")],
      store: prosemirrorDevtoolsStore,
    }) as unknown as TanStackDevtoolsAngularPlugin,
  ];
  private editor?: DemoEditorController;

  ngAfterViewInit(): void {
    this.editor = mountDemoEditor(this.editorHost.nativeElement, {
      customDispatch: true,
      instanceId: "angular-playground-editor",
      label: "Angular playground document",
    });
  }

  protected toggleLatency(event: Event): void {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    this.latencyEnabled.set(enabled);
    this.editor?.setLatencyEnabled(enabled);
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}
