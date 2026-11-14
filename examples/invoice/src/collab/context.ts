import { createContext, useContext } from "react";

import type { CollabSession } from "./session";

/** The collaboration session of this tab, or null in single-user mode. */
export const CollabContext = createContext<CollabSession | null>(null);

export function useCollab(): CollabSession | null {
  return useContext(CollabContext);
}
