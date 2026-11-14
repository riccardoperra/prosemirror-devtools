import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

/**
 * Step 1 announces a state vector and asks for what it lacks. A joining peer also asks the others
 * to announce theirs, so both sides end up with the union.
 */
type Message =
  | { readonly type: "sync-step-1"; readonly stateVector: Uint8Array; readonly joining: boolean }
  | { readonly type: "sync-step-2"; readonly update: Uint8Array }
  | { readonly type: "update"; readonly update: Uint8Array }
  | { readonly type: "awareness"; readonly update: Uint8Array };

type Envelope = Message & { readonly from: number; readonly id: string };

export type ProviderEvent =
  | { readonly kind: "connection"; readonly state: "connected" | "disconnected" }
  | {
      readonly kind: "send" | "receive";
      readonly messageId: string;
      readonly type: Message["type"];
      readonly bytes: number;
    };

export interface ProviderStats {
  readonly bytesSent: number;
  readonly bytesReceived: number;
  /** When the last remote document change arrived. */
  readonly lastSyncAt: number | null;
}

function payload(message: Message): Uint8Array {
  return message.type === "sync-step-1" ? message.stateVector : message.update;
}

/**
 * Syncs a Y.Doc and its awareness between tabs of one browser and origin. BroadcastChannel never
 * leaves the browser, so this is a local demo transport, not a server.
 */
export class BroadcastProvider {
  readonly awareness: Awareness;
  readonly #doc: Y.Doc;
  readonly #channel: BroadcastChannel;
  readonly #listeners = new Set<(event: ProviderEvent) => void>();
  #stats: ProviderStats = { bytesSent: 0, bytesReceived: 0, lastSyncAt: null };
  #sequence = 0;
  #connected = true;

  constructor(room: string, doc: Y.Doc) {
    this.#doc = doc;
    this.awareness = new Awareness(doc);
    this.#channel = new BroadcastChannel(`invoice-workbench:${room}`);
    this.#channel.addEventListener("message", this.#receive);
    doc.on("update", this.#onDocUpdate);
    this.awareness.on("update", this.#onAwarenessUpdate);
    this.#emit({ kind: "connection", state: "connected" });
    this.#send({ type: "sync-step-1", stateVector: Y.encodeStateVector(doc), joining: true });
  }

  get stats(): ProviderStats {
    return this.#stats;
  }

  /** Every message crossing the channel, for the transport inspector and the Invoice tab. */
  subscribe(listener: (event: ProviderEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  destroy(): void {
    if (!this.#connected) return;
    removeAwarenessStates(this.awareness, [this.#doc.clientID], "destroy");
    this.#connected = false;
    this.#doc.off("update", this.#onDocUpdate);
    this.awareness.off("update", this.#onAwarenessUpdate);
    this.#channel.removeEventListener("message", this.#receive);
    this.#channel.close();
    this.awareness.destroy();
    this.#emit({ kind: "connection", state: "disconnected" });
  }

  #emit(event: ProviderEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  #send(message: Message): void {
    if (!this.#connected) return;
    const id = `${this.#doc.clientID}-${++this.#sequence}`;
    const bytes = payload(message).byteLength;
    this.#channel.postMessage({ ...message, from: this.#doc.clientID, id } satisfies Envelope);
    this.#stats = { ...this.#stats, bytesSent: this.#stats.bytesSent + bytes };
    this.#emit({ kind: "send", messageId: id, type: message.type, bytes });
  }

  readonly #receive = ({ data }: MessageEvent<Envelope>): void => {
    const bytes = payload(data).byteLength;
    this.#stats = { ...this.#stats, bytesReceived: this.#stats.bytesReceived + bytes };
    this.#emit({ kind: "receive", messageId: data.id, type: data.type, bytes });
    switch (data.type) {
      case "sync-step-1":
        this.#send({
          type: "sync-step-2",
          update: Y.encodeStateAsUpdate(this.#doc, data.stateVector),
        });
        if (data.joining) {
          const stateVector = Y.encodeStateVector(this.#doc);
          this.#send({ type: "sync-step-1", stateVector, joining: false });
          this.#sendAwareness([this.#doc.clientID]);
        }
        return;
      case "sync-step-2":
      case "update":
        Y.applyUpdate(this.#doc, data.update, this);
        return;
      case "awareness":
        applyAwarenessUpdate(this.awareness, data.update, this);
    }
  };

  readonly #onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) {
      this.#stats = { ...this.#stats, lastSyncAt: Date.now() };
      return;
    }
    this.#send({ type: "update", update });
  };

  readonly #onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin !== this) this.#sendAwareness([...added, ...updated, ...removed]);
  };

  #sendAwareness(clients: readonly number[]): void {
    this.#send({ type: "awareness", update: encodeAwarenessUpdate(this.awareness, [...clients]) });
  }
}
