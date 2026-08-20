import { createReactDevtoolsExtension } from "prosemirror-devtools/react";
import { DevtoolsIntegrationPanel } from "./DevtoolsIntegrationPanel";

export const playgroundDevtoolsExtension = createReactDevtoolsExtension({
  id: "playground-example",
  panels: [
    {
      id: "playground-integration",
      title: "Integration",
      order: 60,
      requiresInstance: false,
      render: (context) => <DevtoolsIntegrationPanel context={context} />,
    },
  ],
});
