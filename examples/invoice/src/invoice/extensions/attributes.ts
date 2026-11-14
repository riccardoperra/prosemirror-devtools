import type { Attribute } from "@tiptap/core";

function dataName(name: string): string {
  return `data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export function textAttribute(name: string, fallback: string, keepOnSplit = true): Attribute {
  return {
    default: fallback,
    keepOnSplit,
    parseHTML: (element) => element.getAttribute(dataName(name)) ?? fallback,
    renderHTML: (attributes) => ({ [dataName(name)]: String(attributes[name]) }),
  };
}

export function numberAttribute(name: string, fallback: number): Attribute {
  return {
    default: fallback,
    parseHTML: (element) => {
      const parsed = Number(element.getAttribute(dataName(name)));
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    renderHTML: (attributes) => ({ [dataName(name)]: String(attributes[name]) }),
  };
}

export function jsonAttribute<T>(name: string, fallback: T): Attribute {
  return {
    default: fallback,
    parseHTML: (element) => {
      const raw = element.getAttribute(dataName(name));
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    renderHTML: (attributes) => ({ [dataName(name)]: JSON.stringify(attributes[name]) }),
  };
}
