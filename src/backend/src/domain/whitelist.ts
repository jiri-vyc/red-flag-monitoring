// M16: a rule × client exemption with a mandatory reason.
export type WhitelistEntry = {
  id: string;
  ruleId: string;
  clientId: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
};
