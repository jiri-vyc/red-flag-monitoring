import { findUnverifiedCitations } from "./evidenceCitations";

const EVIDENCE = {
  finding: {
    growth: { baseClients: 16, addedClients: 3, capExceeded: false },
    proposal: { currentValue: 100000, step: 0.05 },
  },
  clients: [{ clientId: "K003487", minDistance: 0.0229, profile: { riskScore: "low", isPep: false } }],
};

describe("findUnverifiedCitations", () => {
  it("accepts values that equal the evidence at their path", () => {
    expect(
      findUnverifiedCitations(
        [
          { path: "finding.growth.addedClients", value: "3" },
          { path: "finding.proposal.step", value: "0.05" },
          { path: "clients.0.clientId", value: "K003487" },
          { path: "clients[0].profile.isPep", value: "false" },
          { path: "finding.growth.capExceeded", value: " false " },
        ],
        EVIDENCE,
      ),
    ).toEqual([]);
  });

  it("accepts numbers written with spaces or a decimal comma", () => {
    expect(
      findUnverifiedCitations(
        [
          { path: "clients.0.minDistance", value: "0,0229" },
          { path: "finding.proposal.currentValue", value: "100 000" },
        ],
        EVIDENCE,
      ),
    ).toEqual([]);
  });

  it("flags a value that differs from the evidence", () => {
    expect(findUnverifiedCitations([{ path: "finding.growth.addedClients", value: "5" }], EVIDENCE)).toEqual([
      { path: "finding.growth.addedClients", value: "5", reason: "evidence has 3" },
    ]);
  });

  it("flags a rounded number", () => {
    expect(
      findUnverifiedCitations([{ path: "clients.0.minDistance", value: "0.02" }], EVIDENCE),
    ).toHaveLength(1);
  });

  it("flags a path that does not exist", () => {
    expect(findUnverifiedCitations([{ path: "clients.3.clientId", value: "K003487" }], EVIDENCE)).toEqual([
      { path: "clients.3.clientId", value: "K003487", reason: "path does not exist in the evidence" },
    ]);
  });

  it("flags a path that points at an object", () => {
    expect(findUnverifiedCitations([{ path: "finding.growth", value: "3" }], EVIDENCE)[0]?.reason).toBe(
      "path points at an object or a list, not a value",
    );
  });

  it("does not resolve inherited properties", () => {
    expect(findUnverifiedCitations([{ path: "finding.toString", value: "x" }], EVIDENCE)).toHaveLength(1);
  });
});
