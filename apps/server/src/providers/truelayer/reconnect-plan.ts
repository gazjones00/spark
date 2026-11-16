import {
  transactionsResource,
  truelayerAccountExternalId,
  truelayerAccountIdFromExternalId,
} from "@spark/connectors";
import type { TrueLayerAccount } from "@spark/schema";
import type { AccountMove } from "../../modules/connectors";

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

  const allowList = Array.isArray(connectionMetadata.accountIds)
    ? connectionMetadata.accountIds.filter((id): id is string => typeof id === "string")
    : [];
  for (const accountId of allowList) {
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
  const claimed = new Map<string, Set<string>>(
    candidates.map((candidate) => [candidate.connectionId, new Set<string>()]),
  );
  const targetAccountIds = new Set(target.accounts.map((account) => account.accountId));
  const accountMoves: AccountMove[] = [];

  for (const account of selected) {
    const onTarget = findMatch(target, account, claimed);
    if (onTarget) {
      claimed.get(target.connectionId)?.add(onTarget.accountId);
      // Re-issued id: carry the history over to it, unless the target already
      // holds something under the new id.
      if (
        onTarget.synced &&
        onTarget.accountId !== account.accountId &&
        !targetAccountIds.has(account.accountId)
      ) {
        accountMoves.push(move(target.connectionId, onTarget.accountId, account.accountId));
      }
      continue;
    }
    // The target already knows this id under another identity; moving a
    // second account onto it would collide, so leave the source alone.
    if (targetAccountIds.has(account.accountId)) {
      continue;
    }
    for (const other of others) {
      const onOther = findMatch(other, account, claimed);
      if (onOther) {
        claimed.get(other.connectionId)?.add(onOther.accountId);
        if (onOther.synced) {
          accountMoves.push(move(other.connectionId, onOther.accountId, account.accountId));
        }
        break;
      }
    }
  }

  const retiredConnectionIds: string[] = [];
  const narrowedConnections: ReconnectPlan["narrowedConnections"] = [];
  for (const other of others) {
    const taken = claimed.get(other.connectionId);
    if (!taken || taken.size === 0) {
      continue;
    }
    const kept = other.accounts
      .map((account) => account.accountId)
      .filter((accountId) => !taken.has(accountId));
    if (kept.length === 0) {
      retiredConnectionIds.push(other.connectionId);
    } else {
      // Pinned even if it had no allow-list: an absent list means "sync
      // everything", which would pull the moved accounts straight back.
      narrowedConnections.push({
        connectionId: other.connectionId,
        metadata: { ...other.metadata, accountIds: kept },
      });
    }
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

/** An exact id match beats a bank-identifier match on the same connection. */
function findMatch(
  candidate: ReconnectCandidate,
  account: GrantedIdentity,
  claimed: ReadonlyMap<string, ReadonlySet<string>>,
): KnownAccount | undefined {
  const taken = claimed.get(candidate.connectionId);
  const available = candidate.accounts.filter((known) => !taken?.has(known.accountId));
  return (
    available.find((known) => known.accountId === account.accountId) ??
    available.find((known) => known.identityKeys.some((key) => account.identityKeys.has(key)))
  );
}

function matches(known: KnownAccount, account: GrantedIdentity): boolean {
  return (
    known.accountId === account.accountId ||
    known.identityKeys.some((key) => account.identityKeys.has(key))
  );
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
