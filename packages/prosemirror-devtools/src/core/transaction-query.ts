import type { DevtoolsTransactionQuery } from "./types";

export type NormalizedTransactionQuery = {
  offset: number;
  limit?: number;
  order: NonNullable<DevtoolsTransactionQuery["order"]>;
};

export function normalizeTransactionQuery(
  query: DevtoolsTransactionQuery = {},
): NormalizedTransactionQuery {
  const requestedOffset = query.offset ?? 0;
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
  const requestedLimit = query.limit;
  const limit =
    requestedLimit === undefined || requestedLimit === Number.POSITIVE_INFINITY
      ? undefined
      : Number.isFinite(requestedLimit)
        ? Math.max(0, Math.floor(requestedLimit))
        : 0;

  return {
    offset,
    order: query.order === "newest-first" ? "newest-first" : "oldest-first",
    ...(limit === undefined ? {} : { limit }),
  };
}
