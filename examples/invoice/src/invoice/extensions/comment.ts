import { Mark, mergeAttributes } from "@tiptap/core";

export const Comment = Mark.create({
  name: "comment",
  inclusive: false,
  addAttributes: () => ({
    id: {
      default: null,
      rendered: false,
      parseHTML: (element) => element.getAttribute("data-comment-id"),
    },
    author: {
      default: "",
      rendered: false,
      parseHTML: (element) => element.getAttribute("data-author") ?? "",
    },
    resolved: {
      default: false,
      rendered: false,
      parseHTML: (element) => element.getAttribute("data-resolved") === "true",
    },
  }),
  parseHTML: () => [{ tag: "mark[data-comment-id]" }],
  renderHTML: ({ mark, HTMLAttributes }) => [
    "mark",
    mergeAttributes(HTMLAttributes, {
      class: mark.attrs.resolved ? "comment is-resolved" : "comment",
      "data-comment-id": mark.attrs.id,
      "data-author": mark.attrs.author,
      "data-resolved": String(mark.attrs.resolved),
    }),
    0,
  ],
});
