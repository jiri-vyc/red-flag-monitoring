import type { Client } from "../../../domain/client";
import type { ClientEntity } from "../entities/ClientEntity";

export function toClient(entity: ClientEntity): Client {
  return {
    clientId: entity.clientId,
    country: entity.country,
    contractDate: entity.contractDate,
    contractChannel: entity.contractChannel,
    isPep: entity.isPep,
    clientType: entity.clientType,
    projectedMonthlyVolumeCzk: entity.projectedMonthlyVolumeCzk,
    projectedMonthlyTxCount: entity.projectedMonthlyTxCount,
    q2VolumeCzk: entity.q2VolumeCzk,
    q2TxCount: entity.q2TxCount,
    q2MaxTxCzk: entity.q2MaxTxCzk,
    amlRiskScore: entity.amlRiskScore,
  };
}
