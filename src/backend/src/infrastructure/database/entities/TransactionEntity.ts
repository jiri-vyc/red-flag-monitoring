import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { TRANSACTION_TYPES, type TransactionType } from "../../../domain/transaction";
import { isOneOf } from "../sqlChecks";
import { ClientEntity } from "./ClientEntity";

// Constraint and index names must match the existing Aurora databases (golden, main); renaming one needs a migration.
@Entity({ name: "transactions" })
@Check("transactions_transaction_id_check", `"transaction_id" ~ '^TX[0-9]{9}$'`)
@Check("transactions_amount_check", `"amount" > 0`)
@Check("transactions_currency_check", `"currency" ~ '^[A-Z]{3}$'`)
@Check("transactions_payer_country_check", `"payer_country" ~ '^[A-Z]{2}$'`)
@Check("transactions_payee_country_check", `"payee_country" ~ '^[A-Z]{2}$'`)
@Check("transactions_tx_type_check", isOneOf("tx_type", TRANSACTION_TYPES))
@Check("transactions_check", `"tx_type" <> 'outgoing' OR "payer_account" = "client_id"`)
@Check("transactions_check1", `"tx_type" <> 'incoming' OR "payee_account" = "client_id"`)
@Check("transactions_check2", `("tx_type" = 'remittance') = ("payer_account" IS NULL)`)
@Index("transactions_client_id_ts_idx", ["clientId", "occurredAt"])
@Index("transactions_counterparty_account_ts_idx", ["counterpartyAccount", "occurredAt"])
@Index("transactions_ts_idx", ["occurredAt"])
export class TransactionEntity {
  @PrimaryColumn({ name: "transaction_id", type: "text", primaryKeyConstraintName: "transactions_pkey" })
  transactionId!: string;

  @Column({ name: "client_id", type: "text" })
  clientId!: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({
    name: "client_id",
    referencedColumnName: "clientId",
    foreignKeyConstraintName: "transactions_client_id_fkey",
  })
  client!: ClientEntity;

  @Column({ name: "ts", type: "timestamp" })
  occurredAt!: Date;

  @Column({ name: "amount", type: "numeric", precision: 14, scale: 2 })
  amount!: string;

  @Column({ name: "currency", type: "text" })
  currency!: string;

  @Column({ name: "payer_country", type: "text" })
  payerCountry!: string;

  @Column({ name: "payee_country", type: "text" })
  payeeCountry!: string;

  @Column({ name: "payer_account", type: "text", nullable: true })
  payerAccount!: string | null;

  @Column({ name: "payee_account", type: "text" })
  payeeAccount!: string;

  @Column({ name: "tx_type", type: "text" })
  transactionType!: TransactionType;

  @Column({
    name: "counterparty_account",
    type: "text",
    nullable: true,
    generatedType: "STORED",
    asExpression: `CASE WHEN "tx_type" = 'incoming' THEN "payer_account" ELSE "payee_account" END`,
  })
  counterpartyAccount!: string | null;

  @Column({
    name: "counterparty_country",
    type: "text",
    nullable: true,
    generatedType: "STORED",
    asExpression: `CASE WHEN "tx_type" = 'incoming' THEN "payer_country" ELSE "payee_country" END`,
  })
  counterpartyCountry!: string | null;
}
