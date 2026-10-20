import type { DataSource } from "typeorm";

import type { Page, PageRequest } from "../../../application/pagination";
import type {
  TransactionFilter,
  TransactionRepository,
} from "../../../application/transactions/transactionRepository";
import type { Transaction } from "../../../domain/transaction";
import { TransactionEntity } from "../entities/TransactionEntity";
import { toTransaction } from "./transactionMapping";

export class TypeOrmTransactionRepository implements TransactionRepository {
  constructor(private readonly dataSource: DataSource) {}

  // A client filter with the order on ts uses transactions_client_id_ts_idx, without it transactions_ts_idx.
  async listTransactions(filter: TransactionFilter, page: PageRequest): Promise<Page<Transaction>> {
    const query = this.dataSource.getRepository(TransactionEntity).createQueryBuilder("tx");

    if (filter.clientId) {
      query.andWhere("tx.clientId = :clientId", { clientId: filter.clientId });
    }

    if (filter.from) {
      query.andWhere("tx.occurredAt >= :from", { from: filter.from });
    }

    if (filter.to) {
      query.andWhere("tx.occurredAt < :to", { to: filter.to });
    }

    const [entities, total] = await query
      .orderBy("tx.occurredAt", "DESC")
      .addOrderBy("tx.transactionId", "DESC")
      .skip(page.offset)
      .take(page.limit)
      .getManyAndCount();

    return { ...page, items: entities.map(toTransaction), total };
  }
}
