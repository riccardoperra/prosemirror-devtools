export interface CollabUser {
  readonly name: string;
  readonly color: string;
}

export interface CollabConfig {
  readonly room: string;
  readonly user: CollabUser;
}

/** Each name keeps its color in every tab, so carets read the same everywhere. */
const people: readonly CollabUser[] = [
  { name: "Ada", color: "#2383e2" },
  { name: "Grace", color: "#d9730d" },
  { name: "Linus", color: "#0f7b6c" },
  { name: "Margaret", color: "#9065b0" },
];

function colorFor(name: string): string {
  const known = people.find((person) => person.name === name);
  if (known) return known.color;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return people[hash % people.length]!.color;
}

/** Collaboration is opt-in: `?room=<id>&user=<name>`. Without a room the workbench is single-user. */
export function readCollabConfig(search: string): CollabConfig | null {
  const params = new URLSearchParams(search);
  const room = params.get("room")?.trim();
  if (!room) return null;
  const name = params.get("user")?.trim() || people[0]!.name;
  return { room, user: { name, color: colorFor(name) } };
}

export function collabUrl(href: string, room: string, name: string): string {
  const url = new URL(href);
  url.searchParams.set("room", room);
  url.searchParams.set("user", name);
  return url.toString();
}

/** The same room under the next name that is not already this tab's. */
export function secondUserUrl(href: string, config: CollabConfig): string {
  const next = people.find((person) => person.name !== config.user.name) ?? people[1]!;
  return collabUrl(href, config.room, next.name);
}

export function newRoomUrl(href: string): string {
  return collabUrl(href, crypto.randomUUID().slice(0, 8), people[0]!.name);
}
