import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from "@angular/core";
import { mountDemoEditor, type DemoEditorController } from "@prosemirror-devtools/demo-kit";

@Component({
  selector: "app-prosemirror-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #editorHost></div>`,
})
export class ProseMirrorEditor {
  readonly instanceId = input.required<string>();
  readonly label = input.required<string>();
  readonly latencyEnabled = input.required<boolean>();

  private readonly editorHost = viewChild.required<ElementRef<HTMLElement>>("editorHost");
  private editor?: DemoEditorController;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        this.editor = mountDemoEditor(this.editorHost().nativeElement, {
          customDispatch: true,
          instanceId: this.instanceId(),
          label: this.label(),
          latencyEnabled: this.latencyEnabled(),
        });
      },
    });

    effect(() => {
      const enabled = this.latencyEnabled();
      this.editor?.setLatencyEnabled(enabled);
    });
    destroyRef.onDestroy(() => this.editor?.destroy());
  }
}
