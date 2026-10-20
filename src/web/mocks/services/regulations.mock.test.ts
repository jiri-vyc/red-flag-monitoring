import { getCurrentUser } from "@/config/currentUser";

import { readMockDatabase, resetMockDatabase, writeMockDatabase } from "../store/mockDatabase";
import { mockRegulationsService } from "./regulations.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

const deletedBy = getCurrentUser().name;

describe("mock regulations deletion", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("deletes a regulation that nothing cites", async () => {
    const database = readMockDatabase();
    // A fresh id, so no seeded policy or rule cites it.
    const freshRegulation = { ...database.regulations[0]!, id: "reg-fresh" };
    writeMockDatabase({ ...database, regulations: [...database.regulations, freshRegulation] });

    await mockRegulationsService.deleteRegulation({ regulationId: freshRegulation.id, deletedBy });

    expect(readMockDatabase().regulations.some(({ id }) => id === freshRegulation.id)).toBe(false);
    expect(mockRegulationsService.capabilities.canDeleteRegulation).toBe(true);
  });

  it("refuses a regulation that a policy cites and keeps it", async () => {
    const citedRegulationId = readMockDatabase().policies.flatMap(({ legalBases }) => legalBases)[0]!
      .regulationId;

    await expect(
      mockRegulationsService.deleteRegulation({ regulationId: citedRegulationId, deletedBy }),
    ).rejects.toMatchObject({ kind: "validation", message: expect.stringContaining("cited_by_policy") });
    expect(readMockDatabase().regulations.some(({ id }) => id === citedRegulationId)).toBe(true);
  });

  it("refuses a regulation that a rule version cites", async () => {
    const database = readMockDatabase();
    const freshRegulation = { ...database.regulations[0]!, id: "reg-fresh" };
    const [firstRule, ...otherRules] = database.rules;
    const [firstVersion, ...laterVersions] = firstRule!.versions;
    const citingRule = {
      ...firstRule!,
      versions: [
        { ...firstVersion!, legalBases: [{ regulationId: freshRegulation.id, ref: "§ 1" }] },
        ...laterVersions,
      ],
    };
    writeMockDatabase({
      ...database,
      regulations: [...database.regulations, freshRegulation],
      rules: [citingRule, ...otherRules],
    });

    await expect(
      mockRegulationsService.deleteRegulation({ regulationId: freshRegulation.id, deletedBy }),
    ).rejects.toMatchObject({ kind: "validation", message: expect.stringContaining("cited_by_rule") });
  });
});
