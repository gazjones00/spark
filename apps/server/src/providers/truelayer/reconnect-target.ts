import { truelayerAccountIdFromExternalId } from "@spark/connectors";

export interface ReconnectCandidate {
  connectionId: string;
  /** TrueLayer account ids this connection is already known to cover. */
  accountIds: readonly string[];
  createdAt: Date;
}

/**
 * The account ids a connection is known to cover: the allow-list the user
 * picked at connect time, plus whatever it has actually synced. Both are
 * needed — a connection created before the allow-list existed (or one that
 * granted every account) carries no allow-list, and a connection whose
 * accounts were pruned carries an allow-list narrower than its history.
 */
export function candidateAccountIds(
  metadata: Record<string, unknown>,
  syncedAccountExternalIds: readonly string[],
): string[] {
  const allowList = Array.isArray(metadata.accountIds)
    ? metadata.accountIds.filter((id): id is string => typeof id === "string")
    : [];
  return [
    ...new Set([...allowList, ...syncedAccountExternalIds.map(truelayerAccountIdFromExternalId)]),
  ];
}

/**
 * Picks the existing connection that a fresh TrueLayer grant re-authorises,
 * or null when the grant is genuinely new.
 *
 * A reconnect arrives as an ordinary authorisation redirect: TrueLayer echoes
 * nothing that ties it to the consent it replaces, so the accounts behind the
 * grant are the only link back. Any overlap means the same bank accounts sit
 * behind both grants, so the new tokens belong on the connection that already
 * holds them rather than on a second row. No overlap means a different bank,
 * or a second consent over other accounts, and a new connection is correct.
 *
 * Ties go to the widest overlap and then the oldest connection, so repeated
 * reconnects keep converging on one row instead of alternating between two.
 */
export function resolveReconnectTarget(
  candidates: readonly ReconnectCandidate[],
  grantedAccountIds: readonly string[],
): string | null {
  const granted = new Set(grantedAccountIds);
  if (granted.size === 0) {
    return null;
  }

  let best: (ReconnectCandidate & { overlap: number }) | null = null;
  for (const candidate of candidates) {
    const overlap = new Set(candidate.accountIds.filter((id) => granted.has(id))).size;
    if (overlap === 0) {
      continue;
    }
    const wins =
      best === null ||
      overlap > best.overlap ||
      (overlap === best.overlap && candidate.createdAt < best.createdAt);
    if (wins) {
      best = { ...candidate, overlap };
    }
  }

  return best?.connectionId ?? null;
}
