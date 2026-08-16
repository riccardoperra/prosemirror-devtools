import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import type {
  DevtoolsExtension,
  DevtoolsExtensionContext,
  DevtoolsPanelExtension,
} from "../core/extensions";

export interface ReactDevtoolsPanelExtension extends Omit<DevtoolsPanelExtension, "mount"> {
  render(context: DevtoolsExtensionContext): ReactNode;
}

export interface ReactDevtoolsExtensionOptions {
  readonly id: string;
  readonly panels: readonly ReactDevtoolsPanelExtension[];
}

type ReactPanelRenderer = (context: DevtoolsExtensionContext) => ReactNode;

const reactPanelRenderer = Symbol.for("prosemirror-devtools.react-panel-renderer");

/** @internal Lets the React host compose an adapter panel without creating a nested root. */
export function getReactDevtoolsPanelRenderer(
  panel: DevtoolsPanelExtension,
): ReactPanelRenderer | undefined {
  return (panel as DevtoolsPanelExtension & { [reactPanelRenderer]?: ReactPanelRenderer })[
    reactPanelRenderer
  ];
}

/** Adapts React-rendered panels to the framework-neutral DOM mount contract. */
export function createReactDevtoolsExtension(
  options: ReactDevtoolsExtensionOptions,
): DevtoolsExtension {
  return {
    id: options.id,
    panels: options.panels.map((panel): DevtoolsPanelExtension => {
      const adapted: DevtoolsPanelExtension = {
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
      Object.defineProperty(adapted, reactPanelRenderer, {
        enumerable: true,
        value: panel.render,
      });
      return adapted;
    }),
  };
}
