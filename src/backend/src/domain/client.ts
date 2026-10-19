export const CONTRACT_CHANNELS = ["in_person", "distant"] as const;
export type ContractChannel = (typeof CONTRACT_CHANNELS)[number];

export const CLIENT_TYPES = ["natural_person", "entrepreneur", "legal_entity"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const AML_RISK_SCORES = ["low", "medium", "high"] as const;
export type AmlRiskScore = (typeof AML_RISK_SCORES)[number];

export type Client = {
  clientId: string;
  country: string;
  contractDate: string;
  contractChannel: ContractChannel;
  isPep: boolean;
  clientType: ClientType;
  amlRiskScore: AmlRiskScore;
};
