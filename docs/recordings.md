# Share a diagnostic recording

Export bounded evidence when another developer or agent needs to inspect a captured editor without
the original application. A recording contains observed data and coverage. It does not replay an
EditorState, reconstruct private undo branches, or prove a new browser action.

## Export an explicit target

Create the client from the application's devtools store. Discover the exact editor and session,
then export that target.

```ts
import { exportProseMirrorRecording } from "prosemirror-inspector/recordings";

const recording = exportProseMirrorRecording({
  client,
  target,
  transactionIds: [1, 2],
  versions: { app: "your-build-id", inspectionProtocol: "1" },
});
const json = JSON.stringify(recording);
```

By default the exporter selects the latest 25 dispatch IDs. It includes explicit unavailable
records for paused or expired IDs. Current queries and retained before and after scopes use the
common inspection client. The hard total limit is 2,000,000 UTF-8 bytes. `maxBytes` can reduce it to
8,000 bytes. `queryLimits` can reduce each query's default budgets.

Read `omissions` and each query's coverage before drawing conclusions. An omitted query does not
mean that the editor had no data. Application, editor, and provider versions can be supplied in
`versions`. The envelope declares recording format version 1 independently.

## Open a separate offline source

```ts
import {
  parseProseMirrorRecording,
  createProseMirrorRecordingClient,
} from "prosemirror-inspector/recordings";

const recording = parseProseMirrorRecording(json);
const offline = createProseMirrorRecordingClient(recording);
const target = offline.listEditors()[0]?.target;
if (target) {
  const result = offline.query({ target, query: { kind: "document" } });
}
```

Import rejects an unsupported format, incompatible version, invalid shape, incoherent point, and
oversized artifact. Parsing returns a detached immutable artifact. Creating a client gives the
recording a fresh offline source and target. It cannot attach to a live view, restore a document,
or resolve current DOM positions.

Only exact captured query scopes are available. A missing range or query returns `unobserved`.
Historical queries retain their captured meaning and coverage. The offline source remains visible
in results and in the separate viewer.

## Mount the recording viewer

```ts
import { mountProseMirrorRecordingInspector } from "prosemirror-inspector/recordings-panel";

const viewer = mountProseMirrorRecordingInspector(container, { recording, theme: "light" });
viewer.update({ recording: anotherRecording, theme: "dark" });
viewer.unmount();
```

The mount uses the common Solid renderer and is inactive outside development. It reads recorded
document, selection, transaction, provider, and coverage scopes. It has no live editor controls.
The `RecordingInspector` component is also exported for native Solid hosts.

The standalone demo offers file import, download, an explicit export target selector, and a button
to open the last export. Remounting the live editor does not redirect that offline source. Treat
recording contents as application data when an agent reads them.
