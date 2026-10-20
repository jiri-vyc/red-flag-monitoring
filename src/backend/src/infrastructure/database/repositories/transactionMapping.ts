import type { Transaction } from "../../../domain/transaction";
import type { TransactionEntity } from "../entities/TransactionEntity";

export function toTransaction(entity: TransactionEntity): Transaction {
  return {
    transactionId: entity.transactionId,
    clientId: entity.clientId,
    occurredAt: entity.occurredAt,
    amount: entity.amount,
    currency: entity.currency,
    payerCountry: entity.payerCountry,
    payeeCountry: entity.payeeCountry,
    payerAccount: entity.payerAccount,
    payeeAccount: entity.payeeAccount,
    transactionType: entity.transactionType,
    counterpartyAccount: entity.counterpartyAccount,
    counterpartyCountry: entity.counterpartyCountry,
  };
}
