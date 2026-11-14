export interface CollabUser {
  readonly name: string;
  readonly color: string;
}

/** Collaboration is on by default. `?solo` opts out, and `?room=` picks a room other than the default. */
export type CollabConfig =
  | { readonly mode: "solo" }
  | { readonly mode: "room"; readonly room: string; readonly user: CollabUser };

export type RoomConfig = Extract<CollabConfig, { mode: "room" }>;

export const defaultRoom = "invoice";

/** Per tab, so a reload keeps its user while a second tab picks another one. */
const userStorageKey = "invoice-workbench:user";

/** Each name keeps its color in every tab, so carets read the same everywhere. */
const people: readonly CollabUser[] = [
  { name: "Ada", color: "#2383e2" },
  { name: "Grace", color: "#d9730d" },
  { name: "Linus", color: "#0f7b6c" },
  { name: "Margaret", color: "#9065b0" },
  { name: "Alan", color: "#c4403b" },
  { name: "Barbara", color: "#337ea9" },
];

function colorFor(name: string): string {
  const known = people.find((person) => person.name === name);
  if (known) return known.color;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return people[hash % people.length]!.color;
}

export function userNamed(name: string): CollabUser {
  return { name, color: colorFor(name) };
}

/** The first person nobody in the room uses yet, or a numbered guest once the table runs out. */
export function nextFreeUser(taken: readonly string[]): CollabUser {
  const free = people.find((person) => !taken.includes(person.name));
  return free ?? userNamed(`Guest ${Math.floor(100 + Math.random() * 900)}`);
}

function readStoredName(storage: Storage | null): string | null {
  try {
    return storage?.getItem(userStorageKey)?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * The URL names the user when a tab was invited or reloaded, then this tab's stored name. A fresh
 * tab starts as the first person, and the session renames it once the room shows who is taken.
 */
export function readCollabConfig(search: string, storage: Storage | null): CollabConfig {
  const params = new URLSearchParams(search);
  if (params.has("solo")) return { mode: "solo" };
  const room = params.get("room")?.trim() || defaultRoom;
  const name = params.get("user")?.trim() || readStoredName(storage) || people[0]!.name;
  return { mode: "room", room, user: userNamed(name) };
}

/** Writes the room and user back, so the address bar is shareable and a reload keeps both. */
export function rememberIdentity(room: string, user: CollabUser): void {
  try {
    sessionStorage.setItem(userStorageKey, user.name);
  } catch {
    // Storage can be blocked. The URL still carries the user.
  }
  history.replaceState(history.state, "", collabUrl(location.href, room, user.name));
}

export function collabUrl(href: string, room: string, name: string): string {
  const url = new URL(href);
  url.searchParams.delete("solo");
  url.searchParams.set("room", room);
  url.searchParams.set("user", name);
  return url.toString();
}

export function soloUrl(href: string): string {
  const url = new URL(href);
  url.search = "?solo";
  return url.toString();
}

/** Back to the default room. The tab's stored name decides who it joins as. */
export function roomUrl(href: string): string {
  const url = new URL(href);
  url.search = "";
  return url.toString();
}
