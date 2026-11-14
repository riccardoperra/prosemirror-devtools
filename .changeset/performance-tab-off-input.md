---
"prosemirror-inspector": patch
---

The Performance tab no longer slows typing. Plugin hook timings recorded outside a dispatch now notify store subscribers once per microtask instead of once per plugin, and dispatches still publish synchronously. The Performance tab renders store changes when the browser is idle, within 100 ms.
