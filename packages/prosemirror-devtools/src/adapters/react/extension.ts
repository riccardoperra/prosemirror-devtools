import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import type {
  DevtoolsExtension,
  DevtoolsExtensionContext,
  DevtoolsPanelExtension,
} from "../../core/extensions";

export interface ReactDevtoolsPanelExtension extends Omit<DevtoolsPanelExtension, "mount"> {
  render(context: DevtoolsExtensionContext): ReactNode;
}

export interface ReactDevtoolsExtensionOptions {
  readonly id: string;
  readonly panels: readonly ReactDevtoolsPanelExtension[];
}

/** Adapts React-rendered panels to the framework-neutral DOM mount contract. */
export function createReactDevtoolsExtension(
  options: ReactDevtoolsExtensionOptions,
): DevtoolsExtension {
  return {
    id: options.id,
    panels: options.panels.map((panel): DevtoolsPanelExtension => {
      return {
        id: panel.id,
        title: panel.title,
        ...(panel.order === undefined ? {} : { order: panel.order }),
        ...(panel.requiresInstance === undefined
          ? {}
          : { requiresInstance: panel.requiresInstance }),
        mount(container, context) {
          const rootContainer = container.ownerDocument.createElement("div");
          rootContainer.style.height = "100%";
          container.append(rootContainer);
          const root = createRoot(rootContainer);
          let disposed = false;
          const dispose = (): void => {
            if (disposed) return;
            disposed = true;
            rootContainer.remove();
            // The host may be in another React root's commit phase. Defer
            // React cleanup, retaining its detached DOM until unmount finishes.
            queueMicrotask(() => root.unmount());
          };
          try {
            root.render(panel.render(context));
          } catch (error) {
            dispose();
            throw error;
          }
          return dispose;
        },
      };
    }),
  };
}
