export const REGULATION_KINDS = ["law", "decree", "eu_reg", "eu_dir", "guidance"] as const;
export type RegulationKind = (typeof REGULATION_KINDS)[number];

export type Regulation = {
  id: string;
  code: string;
  title: string;
  kind: RegulationKind;
  sourceUrl: string | null;
  checkedAt: Date | null;
};

// M1: a new wording of a regulation is a new row; existing wordings never change.
export type RegulationVersion = {
  id: string;
  regulationId: string;
  label: string;
  fullText: string;
  createdAt: Date;
};

// M2: provisions are not entities, `ref` is free text such as "§ 21".
export type PolicyLegalBasis = { regulationVersionId: string; ref: string | null };
export type RuleLegalBasis = { regulationVersionId: string; ref: string };
