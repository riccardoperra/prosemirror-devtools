import { mergeAttributes, Node } from "@tiptap/core";

import { nodeNames } from "../document";
import { textAttribute } from "./attributes";

export const Parties = Node.create({
  name: nodeNames.parties,
  group: "section",
  content: `${nodeNames.party} ${nodeNames.party}`,
  isolating: true,
  parseHTML: () => [{ tag: "section[data-type=parties]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, { "data-type": "parties", class: "parties" }),
    0,
  ],
});

export const Party = Node.create({
  name: nodeNames.party,
  content: "paragraph+",
  isolating: true,
  defining: true,
  addAttributes: () => ({ role: textAttribute("role", "seller") }),
  parseHTML: () => [{ tag: "address[data-role]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "address",
    mergeAttributes(HTMLAttributes, { class: "party" }),
    0,
  ],
});
