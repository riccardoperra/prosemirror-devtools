import * as Y from "yjs";

import { nodeNames } from "../invoice/document";
import { BroadcastProvider } from "./broadcast-provider";
import type { CollabSession } from "./session";

const syncTimeoutMs = 1000;
/** Long enough to see the bot's avatar arrive, edit, and leave. */
const lingerMs = 1200;

function firstRowText(fragment: Y.XmlFragment): Y.XmlText | null {
  for (const element of fragment.createTreeWalker(
    (type) => type instanceof Y.XmlElement && type.nodeName === nodeNames.lineItem,
  )) {
    const text = (element as Y.XmlElement).toArray().find((child) => child instanceof Y.XmlText);
    if (text) return text as Y.XmlText;
  }
  return null;
}

function receivedFrom(doc: Y.Doc, provider: BroadcastProvider): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => done(false), syncTimeoutMs);
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === provider) done(true);
    };
    const done = (synced: boolean) => {
      clearTimeout(timer);
      doc.off("update", onUpdate);
      resolve(synced);
    };
    doc.on("update", onUpdate);
  });
}

/**
 * A second Yjs client in this tab, on its own BroadcastChannel object. It joins the room like any
 * other tab, so its edit reaches the editor through the real transport as a remote update.
 */
export async function simulateRemoteEdit(collab: CollabSession): Promise<boolean> {
  const doc = new Y.Doc();
  const provider = new BroadcastProvider(collab.config.room, doc);
  try {
    const synced = receivedFrom(doc, provider);
    provider.awareness.setLocalStateField("user", {
      name: "Remote bot",
      color: "#787774",
      joinedAt: Date.now(),
    });
    if (!(await synced)) return false;
    const text = firstRowText(doc.getXmlFragment("default"));
    if (!text) return false;
    text.insert(text.length, " (edited remotely)");
    await new Promise((resolve) => setTimeout(resolve, lingerMs));
    return true;
  } finally {
    provider.destroy();
    doc.destroy();
  }
}
