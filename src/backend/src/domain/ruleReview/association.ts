import { MILLISECONDS_PER_HOUR } from "../features/calendar";
import {
  getCounterpartyAccount,
  isOutgoingTransaction,
  type PricedTransaction,
} from "../features/pricedTransaction";
import type { ReviewDataset } from "./reviewDataset";
import type { AssociationCaps } from "./ruleReviewParams";
import type { RuleReviewFinding } from "./ruleReviewReport";

export type SeedReasons = ReadonlyMap<string, readonly string[]>;

export type StrongFlow = {
  account: string;
  seedClientId: string;
  seedTransactionId: string;
  clientTransactionId: string;
  hoursBetween: number;
};

export type LinkedClient = {
  clientId: string;
  accountsBySeed: Map<string, Set<string>>;
  strongFlows: StrongFlow[];
};

export type AccountIndex = ReadonlyMap<string, ReadonlySet<string>>;

export type AssociationLinkRow = {
  maxClientsPerAccount: number | null;
  linkedClients: number;
  linkedViaTwoOrMoreAccounts: number;
};

export type CounterpartyStructure = {
  accountCount: number;
  clientsPerAccount: { median: number; p90: number; p99: number; max: number };
  seedCount: number;
  linkTable: AssociationLinkRow[];
  strongFlowClients: { privateAccounts: number; anyAccount: number };
};

const LINK_TABLE_THRESHOLDS = [2, 3, 5, 10, 50];

export function collectSeeds(input: {
  dataset: ReviewDataset;
  clientIdsByRuleCode: ReadonlyMap<string, ReadonlySet<string>>;
  caps: AssociationCaps;
}): SeedReasons {
  const reasonsByClientId = new Map<string, string[]>();
  const addReason = (clientId: string, reason: string) =>
    reasonsByClientId.set(clientId, [...(reasonsByClientId.get(clientId) ?? []), reason]);

  for (const client of input.dataset.clientsById.values()) {
    if (client.amlRiskScore === "high") {
      addReason(client.clientId, "risk_score_high");
    }

    if (client.isPep) {
      addReason(client.clientId, "pep");
    }
  }

  for (const ruleCode of input.caps.seedRuleCodes) {
    for (const clientId of input.clientIdsByRuleCode.get(ruleCode) ?? []) {
      addReason(clientId, `rule_hit:${ruleCode}`);
    }
  }

  return reasonsByClientId;
}

export function indexCounterpartyAccounts(dataset: ReviewDataset): AccountIndex {
  const clientIdsByAccount = new Map<string, Set<string>>();

  for (const history of dataset.historiesByClientId.values()) {
    for (const transaction of history) {
      const account = getCounterpartyAccount(transaction);

      if (account) {
        const clientIds = clientIdsByAccount.get(account) ?? new Set<string>();
        clientIds.add(transaction.clientId);
        clientIdsByAccount.set(account, clientIds);
      }
    }
  }

  return clientIdsByAccount;
}

// maxClientsPerAccount null: any account, hubs included.
export function findLinkedClients(input: {
  dataset: ReviewDataset;
  accountIndex: AccountIndex;
  seeds: SeedReasons;
  maxClientsPerAccount: number | null;
  caps: AssociationCaps;
}): LinkedClient[] {
  const linkedById = new Map<string, LinkedClient>();
  const getLinked = (clientId: string): LinkedClient => {
    const linked = linkedById.get(clientId) ?? { clientId, accountsBySeed: new Map(), strongFlows: [] };
    linkedById.set(clientId, linked);

    return linked;
  };

  for (const [account, clientIds] of input.accountIndex) {
    if (input.maxClientsPerAccount !== null && clientIds.size > input.maxClientsPerAccount) {
      continue;
    }

    const seedIds = [...clientIds].filter((clientId) => input.seeds.has(clientId));

    for (const clientId of clientIds) {
      if (input.seeds.has(clientId)) {
        continue;
      }

      for (const seedId of seedIds) {
        const accounts = getLinked(clientId).accountsBySeed.get(seedId) ?? new Set<string>();
        accounts.add(account);
        getLinked(clientId).accountsBySeed.set(seedId, accounts);
      }
    }
  }

  for (const strongFlow of findStrongFlows(input)) {
    getLinked(strongFlow.clientId).strongFlows.push(strongFlow.flow);
  }

  return [...linkedById.values()].filter(
    (linked) => linked.accountsBySeed.size > 0 || linked.strongFlows.length > 0,
  );
}

export function countDistinctLinks(linked: LinkedClient): number {
  return new Set([...linked.accountsBySeed.values()].flatMap((accounts) => [...accounts])).size;
}

export function buildAssociationFindings(input: {
  dataset: ReviewDataset;
  accountIndex: AccountIndex;
  seeds: SeedReasons;
  caps: AssociationCaps;
}): RuleReviewFinding[] {
  const linkedClients = findLinkedClients({
    ...input,
    maxClientsPerAccount: input.caps.maxClientsPerPrivateAccount,
  });

  return linkedClients
    .filter(
      (linked) => countDistinctLinks(linked) >= input.caps.minDistinctLinks || linked.strongFlows.length > 0,
    )
    .sort(
      (left, right) =>
        right.strongFlows.length - left.strongFlows.length ||
        countDistinctLinks(right) - countDistinctLinks(left) ||
        left.clientId.localeCompare(right.clientId),
    )
    .slice(0, input.caps.maxLinkedClients)
    .map((linked) => toAssociationFinding(linked, input));
}

export function describeCounterpartyStructure(input: {
  dataset: ReviewDataset;
  accountIndex: AccountIndex;
  seeds: SeedReasons;
  caps: AssociationCaps;
}): CounterpartyStructure {
  const sizes = [...input.accountIndex.values()]
    .map((clientIds) => clientIds.size)
    .sort((left, right) => left - right);
  const linkTable = LINK_TABLE_THRESHOLDS.map((maxClientsPerAccount) => {
    const linkedClients = findLinkedClients({ ...input, maxClientsPerAccount }).filter(
      (linked) => linked.accountsBySeed.size > 0,
    );

    return {
      maxClientsPerAccount,
      linkedClients: linkedClients.length,
      linkedViaTwoOrMoreAccounts: linkedClients.filter((linked) => countDistinctLinks(linked) >= 2).length,
    };
  });

  return {
    accountCount: sizes.length,
    clientsPerAccount: {
      median: percentile(sizes, 0.5),
      p90: percentile(sizes, 0.9),
      p99: percentile(sizes, 0.99),
      max: sizes.at(-1) ?? 0,
    },
    seedCount: input.seeds.size,
    linkTable,
    strongFlowClients: {
      privateAccounts: countStrongFlowClients(input, input.caps.maxClientsPerPrivateAccount),
      anyAccount: countStrongFlowClients(input, null),
    },
  };
}

function countStrongFlowClients(
  input: { dataset: ReviewDataset; accountIndex: AccountIndex; seeds: SeedReasons; caps: AssociationCaps },
  maxClientsPerAccount: number | null,
): number {
  return new Set(findStrongFlows({ ...input, maxClientsPerAccount }).map((strongFlow) => strongFlow.clientId))
    .size;
}

function findStrongFlows(input: {
  dataset: ReviewDataset;
  accountIndex: AccountIndex;
  seeds: SeedReasons;
  maxClientsPerAccount: number | null;
  caps: AssociationCaps;
}): { clientId: string; flow: StrongFlow }[] {
  const windowMs = input.caps.strongFlowWindowHours * MILLISECONDS_PER_HOUR;
  const { seedPayments, clientReceipts } = collectFlowLegs(input);
  const strongFlows: { clientId: string; flow: StrongFlow }[] = [];

  for (const [account, receipts] of clientReceipts) {
    const payments = seedPayments.get(account) ?? [];

    for (const receipt of receipts) {
      const payment = payments.find(
        (candidate) =>
          candidate.occurredAtMs < receipt.occurredAtMs &&
          receipt.occurredAtMs - candidate.occurredAtMs <= windowMs,
      );

      if (payment) {
        strongFlows.push({
          clientId: receipt.clientId,
          flow: {
            account,
            seedClientId: payment.clientId,
            seedTransactionId: payment.transactionId,
            clientTransactionId: receipt.transactionId,
            hoursBetween:
              Math.round(((receipt.occurredAtMs - payment.occurredAtMs) / MILLISECONDS_PER_HOUR) * 10) / 10,
          },
        });
      }
    }
  }

  return strongFlows;
}

function collectFlowLegs(input: {
  dataset: ReviewDataset;
  accountIndex: AccountIndex;
  seeds: SeedReasons;
  maxClientsPerAccount: number | null;
  caps: AssociationCaps;
}): { seedPayments: Map<string, PricedTransaction[]>; clientReceipts: Map<string, PricedTransaction[]> } {
  const seedPayments = new Map<string, PricedTransaction[]>();
  const clientReceipts = new Map<string, PricedTransaction[]>();
  const isEligibleAccount = (account: string) =>
    input.maxClientsPerAccount === null ||
    (input.accountIndex.get(account)?.size ?? Infinity) <= input.maxClientsPerAccount;

  for (const history of input.dataset.historiesByClientId.values()) {
    for (const transaction of history) {
      const account = getCounterpartyAccount(transaction);

      if (
        !account ||
        transaction.amountCzk < input.caps.strongFlowMinAmountCzk ||
        !isEligibleAccount(account)
      ) {
        continue;
      }

      const isSeed = input.seeds.has(transaction.clientId);

      if (isSeed && isOutgoingTransaction(transaction)) {
        appendTo(seedPayments, account, transaction);
      } else if (!isSeed && transaction.transactionType === "incoming") {
        appendTo(clientReceipts, account, transaction);
      }
    }
  }

  return { seedPayments, clientReceipts };
}

function appendTo(
  transactionsByAccount: Map<string, PricedTransaction[]>,
  account: string,
  transaction: PricedTransaction,
) {
  const transactions = transactionsByAccount.get(account) ?? [];
  transactions.push(transaction);
  transactionsByAccount.set(account, transactions);
}

function toAssociationFinding(
  linked: LinkedClient,
  input: { dataset: ReviewDataset; seeds: SeedReasons },
): RuleReviewFinding {
  const sharedAccounts = new Set([...linked.accountsBySeed.values()].flatMap((accounts) => [...accounts]));
  const flowAccounts = linked.strongFlows.map((flow) => flow.account);
  const linkedSeedIds = new Set([
    ...linked.accountsBySeed.keys(),
    ...linked.strongFlows.map((flow) => flow.seedClientId),
  ]);
  const clientTransactions = (input.dataset.historiesByClientId.get(linked.clientId) ?? []).filter(
    (transaction) => {
      const account = getCounterpartyAccount(transaction);

      return account !== null && (sharedAccounts.has(account) || flowAccounts.includes(account));
    },
  );

  return {
    id: `association:${linked.clientId}`,
    kind: "association",
    rule: null,
    proposal: null,
    growth: null,
    clients: [
      {
        clientId: linked.clientId,
        transactionIds: clientTransactions.map((transaction) => transaction.transactionId),
        nearMissCount: 0,
        distinctDays: new Set(clientTransactions.map((transaction) => transaction.dateKey)).size,
        minDistance: null,
        seedLinks: [...linkedSeedIds].sort().map((seedClientId) => ({
          seedClientId,
          seedReasons: [...(input.seeds.get(seedClientId) ?? [])],
          accounts: [
            ...new Set([
              ...(linked.accountsBySeed.get(seedClientId) ?? []),
              ...linked.strongFlows
                .filter((flow) => flow.seedClientId === seedClientId)
                .map((flow) => flow.account),
            ]),
          ].sort(),
        })),
      },
    ],
    evidence: {
      distinctLinks: countDistinctLinks(linked),
      sharedAccounts: [...sharedAccounts].sort(),
      strongFlows: linked.strongFlows,
    },
  };
}

function percentile(sortedValues: readonly number[], share: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(share * sortedValues.length))] ?? 0;
}
