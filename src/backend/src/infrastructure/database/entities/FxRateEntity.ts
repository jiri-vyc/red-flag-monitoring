import { Check, Column, Entity, PrimaryColumn } from "typeorm";

// V11: ČNB rate per currency and day, used to convert transaction amounts to CZK.
@Entity({ name: "fx_rates" })
@Check("fx_rates_currency_check", `"currency" ~ '^[A-Z]{3}$'`)
@Check("fx_rates_czk_per_unit_check", `"czk_per_unit" > 0`)
export class FxRateEntity {
  @PrimaryColumn({ name: "currency", type: "text", primaryKeyConstraintName: "fx_rates_pkey" })
  currency!: string;

  @PrimaryColumn({ name: "rate_date", type: "date", primaryKeyConstraintName: "fx_rates_pkey" })
  rateDate!: string;

  @Column({ name: "czk_per_unit", type: "numeric", precision: 14, scale: 6 })
  czkPerUnit!: string;

  @Column({ name: "source", type: "text", default: "CNB" })
  source!: string;
}
