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
          const root = createRoot(container);
          root.render(panel.render(context));
          return () => root.unmount();
        },
      };
    }),
  };
}
