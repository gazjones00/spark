import {
  transactionsResource,
  truelayerAccountExternalId,
  truelayerAccountIdFromExternalId,
} from "@spark/connectors";
import type { TrueLayerAccount } from "@spark/schema";
import type { AccountMove } from "../account-relocation";

/** An account an existing connection is known to cover. */
export interface KnownAccount {
  /** The TrueLayer account id the connection knows it by. */
  accountId: string;
  /** Whether the connection holds rows for it (an allow-list entry alone has none). */
  synced: boolean;
  /** Bank identifiers that survive TrueLayer re-issuing the account id. */
  identityKeys: readonly string[];
}

export interface ReconnectCandidate {
  connectionId: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
  accounts: readonly KnownAccount[];
}

export interface ReconnectPlan {
  targetConnectionId: string;
  accountMoves: AccountMove[];
  retiredConnectionIds: string[];
  narrowedConnections: Array<{ connectionId: string; metadata: Record<string, unknown> }>;
}

interface GrantedIdentity {
  accountId: string;
  identityKeys: ReadonlySet<string>;
}

/**
 * The accounts a connection is known to cover: the ones it has synced, plus
 * any on its allow-list that have not synced yet. A connection created before
 * the allow-list existed (or one that granted every account) carries no
 * allow-list, and one whose accounts were pruned carries a narrower one than
 * its history, so neither source alone is enough.
 */
export function knownAccounts(
  connectionMetadata: Record<string, unknown>,
  syncedAccounts: ReadonlyArray<{ externalId: string; metadata: Record<string, unknown> }>,
): KnownAccount[] {
  const known = new Map<string, KnownAccount>();
  for (const account of syncedAccounts) {
    const accountId =
      typeof account.metadata.truelayerAccountId === "string"
        ? account.metadata.truelayerAccountId
        : truelayerAccountIdFromExternalId(account.externalId);
    known.set(accountId, {
      accountId,
      synced: true,
      identityKeys: accountIdentityKeys({
        accountType: account.metadata.truelayerAccountType,
        accountNumber: account.metadata.accountNumber,
        provider: account.metadata.provider,
      }),
    });
  }

  for (const accountId of allowListOf(connectionMetadata) ?? []) {
    if (!known.has(accountId)) {
      known.set(accountId, { accountId, synced: false, identityKeys: [] });
    }
  }
  return [...known.values()];
}

/**
 * Identifiers for the bank account itself rather than TrueLayer's handle on
 * it. TrueLayer may issue a new account_id when the user consents again, so a
 * reconnect is recognised by these instead: IBAN, UK sort code + account
 * number, or — for cards, which expose only a partial number — that partial
 * number scoped to the bank and account kind so one bank's "…1234" never
 * matches another's.
 */
export function accountIdentityKeys(account: {
  accountType?: unknown;
  accountNumber?: unknown;
  provider?: unknown;
}): string[] {
  const accountNumber = asRecord(account.accountNumber);
  const keys: string[] = [];

  const iban = compact(accountNumber.iban)?.toUpperCase();
  if (iban) {
    keys.push(`iban:${iban}`);
  }

  const number = compact(accountNumber.number);
  const sortCode = compact(accountNumber.sortCode)?.replace(/\D/g, "");
  if (number && sortCode) {
    keys.push(`sort-code:${sortCode}:${number}`);
  } else if (number) {
    const bank = compact(asRecord(account.provider).providerId);
    if (bank) {
      const kind = isCardType(account.accountType) ? "card" : "account";
      keys.push(`number:${bank}:${kind}:${number}`);
    }
  }
  return keys;
}

/**
 * Works out which of the user's connections a fresh TrueLayer grant renews,
 * and what has to move for that connection to own every account the user
 * selected — or null when the grant is genuinely new.
 *
 * A reconnect arrives as an ordinary authorisation redirect: TrueLayer echoes
 * nothing that ties it to the consent it replaces, so the accounts behind the
 * grant are the only link back. An account matches on its TrueLayer id or, if
 * TrueLayer re-issued that id, on its bank identifiers.
 *
 * The target is the connection most of the *selected* accounts already live
 * on — the one the user set out to reconnect — then the one most of the grant
 * overlaps (a narrowed selection is still the same connection), then the
 * oldest, then the lowest id, so repeated reconnects converge on one row.
 *
 * A selected account that lives on another connection moves to the target
 * with its history rather than appearing twice; a connection left with no
 * accounts is retired, and one left with some keeps an allow-list of just
 * those. Unselected accounts stay where they are.
 */
export function planReconnect(
  candidates: readonly ReconnectCandidate[],
  grantedAccounts: readonly TrueLayerAccount[],
  selectedAccountIds: readonly string[],
): ReconnectPlan | null {
  const granted: GrantedIdentity[] = grantedAccounts.map((account) => ({
    accountId: account.accountId,
    identityKeys: new Set(accountIdentityKeys(account)),
  }));
  const selectedIds = new Set(selectedAccountIds);
  const selected = granted.filter((account) => selectedIds.has(account.accountId));

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      selectedOverlap: countMatched(candidate, selected),
      grantedOverlap: countMatched(candidate, granted),
    }))
    .filter((entry) => entry.grantedOverlap > 0)
    .sort(
      (a, b) =>
        b.selectedOverlap - a.selectedOverlap ||
        b.grantedOverlap - a.grantedOverlap ||
        compareByAge(a.candidate, b.candidate),
    );
  const target = ranked.at(0)?.candidate;
  if (!target) {
    return null;
  }

  const others = ranked
    .slice(1)
    .map((entry) => entry.candidate)
    .sort(compareByAge);
  const targetAccountIds = new Set(target.accounts.map((account) => account.accountId));
  const matched = new Map<string, { connection: ReconnectCandidate; known: KnownAccount }>();
  const claimed = new Map<string, Set<string>>(
    candidates.map((candidate) => [candidate.connectionId, new Set<string>()]),
  );
  const claim = (connection: ReconnectCandidate, found: Map<string, KnownAccount>) => {
    for (const [accountId, known] of found) {
      matched.set(accountId, { connection, known });
      claimed.get(connection.connectionId)?.add(known.accountId);
    }
  };
  const unmatched = () => selected.filter((account) => !matched.has(account.accountId));
  const available = (connection: ReconnectCandidate) =>
    connection.accounts.filter(
      (known) => !claimed.get(connection.connectionId)?.has(known.accountId),
    );

  // Tiered so that no account can take a row another account owns by id:
  // every exact id on the target is claimed before any bank-identifier match
  // there, and the target is settled before other connections are searched.
  claim(target, matchById(available(target), unmatched()));
  claim(target, matchByIdentity(available(target), unmatched()));
  // An id the target already knows (under another identity) cannot take a
  // second account's history, so those accounts are not looked for elsewhere.
  const movable = () => unmatched().filter((account) => !targetAccountIds.has(account.accountId));
  for (const other of others) {
    claim(other, matchById(available(other), movable()));
  }
  for (const other of others) {
    claim(other, matchByIdentity(available(other), movable()));
  }

  const accountMoves: AccountMove[] = [];
  for (const account of selected) {
    const match = matched.get(account.accountId);
    if (!match?.known.synced) {
      continue;
    }
    const onTarget = match.connection === target;
    // On the target, only a re-issued id moves anything — and never onto an
    // id the target already holds rows under.
    if (
      onTarget &&
      (match.known.accountId === account.accountId || targetAccountIds.has(account.accountId))
    ) {
      continue;
    }
    accountMoves.push(
      move(match.connection.connectionId, match.known.accountId, account.accountId),
    );
  }

  const retiredConnectionIds: string[] = [];
  const narrowedConnections: ReconnectPlan["narrowedConnections"] = [];
  for (const other of others) {
    const taken = claimed.get(other.connectionId);
    if (!taken || taken.size === 0) {
      continue;
    }
    if (other.accounts.every((known) => taken.has(known.accountId))) {
      retiredConnectionIds.push(other.connectionId);
      continue;
    }
    // An existing allow-list keeps its exclusions: the moved accounts leave
    // it and nothing joins. Without one the connection synced everything,
    // which would pull the moved accounts straight back, so it is pinned to
    // the accounts it keeps.
    const allowList = allowListOf(other.metadata);
    const accountIds = (allowList ?? other.accounts.map((known) => known.accountId)).filter(
      (accountId) => !taken.has(accountId),
    );
    narrowedConnections.push({
      connectionId: other.connectionId,
      metadata: { ...other.metadata, accountIds },
    });
  }

  return {
    targetConnectionId: target.connectionId,
    accountMoves,
    retiredConnectionIds,
    narrowedConnections,
  };
}

function countMatched(candidate: ReconnectCandidate, accounts: readonly GrantedIdentity[]): number {
  return accounts.filter((account) => candidate.accounts.some((known) => matches(known, account)))
    .length;
}

function matchById(
  available: readonly KnownAccount[],
  accounts: readonly GrantedIdentity[],
): Map<string, KnownAccount> {
  const found = new Map<string, KnownAccount>();
  for (const account of accounts) {
    const known = available.find((candidate) => candidate.accountId === account.accountId);
    if (known) {
      found.set(account.accountId, known);
    }
  }
  return found;
}

/**
 * Bank-identifier matches, kept only when unambiguous both ways: one known
 * account looks like the granted one, and no other granted account looks like
 * it. Two cards at one bank can share a partial number; attaching one card's
 * history to the other is worse than treating it as new.
 */
function matchByIdentity(
  available: readonly KnownAccount[],
  accounts: readonly GrantedIdentity[],
): Map<string, KnownAccount> {
  const candidates = new Map<string, KnownAccount>();
  const claimants = new Map<string, number>();
  for (const account of accounts) {
    const lookalikes = available.filter((known) => sharesIdentity(known, account));
    const [known] = lookalikes;
    if (lookalikes.length === 1 && known) {
      candidates.set(account.accountId, known);
      claimants.set(known.accountId, (claimants.get(known.accountId) ?? 0) + 1);
    }
  }
  return new Map([...candidates].filter(([, known]) => claimants.get(known.accountId) === 1));
}

function matches(known: KnownAccount, account: GrantedIdentity): boolean {
  return known.accountId === account.accountId || sharesIdentity(known, account);
}

function sharesIdentity(known: KnownAccount, account: GrantedIdentity): boolean {
  return known.identityKeys.some((key) => account.identityKeys.has(key));
}

function allowListOf(metadata: Record<string, unknown>): string[] | null {
  return Array.isArray(metadata.accountIds)
    ? metadata.accountIds.filter((id): id is string => typeof id === "string")
    : null;
}

function compareByAge(a: ReconnectCandidate, b: ReconnectCandidate): number {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.connectionId < b.connectionId ? -1 : a.connectionId > b.connectionId ? 1 : 0)
  );
}

function move(fromConnectionId: string, fromAccountId: string, toAccountId: string): AccountMove {
  return {
    fromConnectionId,
    fromExternalId: truelayerAccountExternalId(fromAccountId),
    toExternalId: truelayerAccountExternalId(toAccountId),
    // The per-account checkpoint follows, so the next sync stays incremental
    // instead of re-reading the full history window.
    cursorResources: [
      { from: transactionsResource(fromAccountId), to: transactionsResource(toAccountId) },
    ],
    // The id is mirrored in metadata, which readers prefer over the external
    // id (the allow-list rebuild on account deletion, the API's accountId);
    // left stale it would point them at the old id until the next sync.
    ...(fromAccountId === toAccountId
      ? {}
      : { accountMetadata: { truelayerAccountId: toAccountId } }),
  };
}

function isCardType(accountType: unknown): boolean {
  return accountType === "CREDIT_CARD" || accountType === "CHARGE_CARD";
}

function compact(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
