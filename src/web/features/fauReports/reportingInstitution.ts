import type { ReportingInstitution } from "./types";

/**
 * MP FAÚ č. 4, section II. A fictional placeholder, not a real company: the institution's details will come
 * from the backend configuration (issue #20). The obliged-entity type must be confirmed by compliance.
 */
export const DEMO_REPORTING_INSTITUTION: ReportingInstitution = {
  name: "Demo instituce s.r.o. (fiktivní)",
  companyId: "00000000",
  address: "Ukázková 1, 000 00 Demo (fiktivní adresa)",
  obligedEntityType:
    "§ 2 odst. 1 písm. b) AML zákona, finanční instituce (bod doplnit a ověřit s compliance)",
};
