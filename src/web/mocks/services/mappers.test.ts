import type { MockDatabase, MockRegulationRecord } from "../store/mockDatabase";
import { mapRegulationRecord } from "./mappers";

const EMPTY_DATABASE: MockDatabase = {
  regulations: [],
  policies: [],
  rules: [],
  ruleCheckKinds: {},
  whitelistEntries: [],
  batches: [],
  draftingJobs: [],
  fauReports: [],
};

const RECORD: MockRegulationRecord = {
  id: "reg-aml-act",
  name: "Zákon o AML",
  shortName: "AMLZ",
  jurisdiction: "CZ",
  description: "",
  sourceUrl: "https://www.zakonyprolidi.cz/cs/2008-253",
  version: "znění 2026",
  lastCheckedAt: "",
  keyProvisions: [],
};

describe("mapRegulationRecord", () => {
  it("keeps an http(s) source URL", () => {
    expect(mapRegulationRecord(RECORD, EMPTY_DATABASE).sourceUrl).toBe(RECORD.sourceUrl);
  });

  it("drops a source URL that is not http(s), like the live adapter", () => {
    const record = { ...RECORD, sourceUrl: "javascript:alert(1)" };

    expect(mapRegulationRecord(record, EMPTY_DATABASE).sourceUrl).toBe("");
  });
});
