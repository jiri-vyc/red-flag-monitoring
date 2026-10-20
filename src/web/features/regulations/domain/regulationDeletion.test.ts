import { findRegulationDeletionBlocker } from "./regulationDeletion";

const CITATION = { regulationId: "reg-1", ref: "§ 6" };
const OTHER_CITATION = { regulationId: "reg-2", ref: "§ 9" };

const policyCiting = (current: (typeof CITATION)[], older: (typeof CITATION)[]) => ({
  legalBases: current,
  versions: [{ legalBases: older }, { legalBases: current }],
});
const ruleCiting = (...versionLegalBases: (typeof CITATION)[][]) => ({
  versions: versionLegalBases.map((legalBases) => ({ legalBases })),
});

type Citations = Parameters<typeof findRegulationDeletionBlocker>[1];
const citations = ({ policies = [], rules = [] }: Partial<Citations>): Citations => ({ policies, rules });

describe("findRegulationDeletionBlocker", () => {
  it("allows deleting a regulation nothing cites", () => {
    const blocker = findRegulationDeletionBlocker(
      "reg-1",
      citations({ policies: [policyCiting([OTHER_CITATION], [])], rules: [ruleCiting([OTHER_CITATION])] }),
    );

    expect(blocker).toBeNull();
  });

  it("refuses a regulation a policy cites, also in an older version only", () => {
    expect(
      findRegulationDeletionBlocker("reg-1", citations({ policies: [policyCiting([CITATION], [])] })),
    ).toBe("cited_by_policy");
    expect(
      findRegulationDeletionBlocker("reg-1", citations({ policies: [policyCiting([], [CITATION])] })),
    ).toBe("cited_by_policy");
  });

  it("refuses a regulation any rule version cites", () => {
    expect(
      findRegulationDeletionBlocker(
        "reg-1",
        citations({ rules: [ruleCiting([CITATION], [OTHER_CITATION])] }),
      ),
    ).toBe("cited_by_rule");
  });
});
