import { Check, Column, Entity, PrimaryColumn } from "typeorm";

import {
  AML_RISK_SCORES,
  type AmlRiskScore,
  CLIENT_TYPES,
  type ClientType,
  CONTRACT_CHANNELS,
  type ContractChannel,
} from "../../../domain/client";
import { isOneOf } from "../sqlChecks";

// Constraint names must match the existing Aurora databases (golden, main); renaming one needs a migration.
@Entity({ name: "clients" })
@Check("clients_client_id_check", `"client_id" ~ '^K[0-9]{6}$'`)
@Check("clients_country_check", `"country" ~ '^[A-Z]{2}$'`)
@Check("clients_contract_channel_check", isOneOf("contract_channel", CONTRACT_CHANNELS))
@Check("clients_client_type_check", isOneOf("client_type", CLIENT_TYPES))
@Check("clients_projected_monthly_volume_czk_check", `"projected_monthly_volume_czk" >= 0`)
@Check("clients_projected_monthly_tx_count_check", `"projected_monthly_tx_count" >= 0`)
@Check("clients_q2_volume_czk_check", `"q2_volume_czk" >= 0`)
@Check("clients_q2_tx_count_check", `"q2_tx_count" >= 0`)
@Check("clients_q2_max_tx_czk_check", `"q2_max_tx_czk" >= 0`)
@Check("clients_aml_risk_score_check", isOneOf("aml_risk_score", AML_RISK_SCORES))
export class ClientEntity {
  @PrimaryColumn({ name: "client_id", type: "text", primaryKeyConstraintName: "clients_pkey" })
  clientId!: string;

  @Column({ name: "country", type: "text" })
  country!: string;

  @Column({ name: "contract_date", type: "date" })
  contractDate!: string;

  @Column({ name: "contract_channel", type: "text" })
  contractChannel!: ContractChannel;

  @Column({ name: "is_pep", type: "boolean" })
  isPep!: boolean;

  @Column({ name: "client_type", type: "text" })
  clientType!: ClientType;

  @Column({ name: "projected_monthly_volume_czk", type: "numeric", precision: 14, scale: 2 })
  projectedMonthlyVolumeCzk!: string;

  @Column({ name: "projected_monthly_tx_count", type: "integer" })
  projectedMonthlyTxCount!: number;

  @Column({ name: "q2_volume_czk", type: "numeric", precision: 14, scale: 2 })
  q2VolumeCzk!: string;

  @Column({ name: "q2_tx_count", type: "integer" })
  q2TxCount!: number;

  @Column({ name: "q2_max_tx_czk", type: "numeric", precision: 14, scale: 2 })
  q2MaxTxCzk!: string;

  @Column({ name: "aml_risk_score", type: "text" })
  amlRiskScore!: AmlRiskScore;
}
