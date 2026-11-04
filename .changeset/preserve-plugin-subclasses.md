---
"prosemirror-inspector": patch
---

Preserve plugin subclass prototypes during instrumentation so `instanceof` checks and custom fields, accessors, and methods continue to work, including methods that use private fields.
