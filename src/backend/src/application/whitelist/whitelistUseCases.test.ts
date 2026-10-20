import { BusinessRuleViolationError, NotFoundError } from "../errors";
import { InMemoryRuleRepository } from "../testing/InMemoryRuleRepository";
import { InMemoryWhitelistRepository } from "../testing/InMemoryWhitelistRepository";
import { ADMIN_ID } from "../testing/fixtures";
import { WhitelistUseCases } from "./whitelistUseCases";

async function setUp({ isWhitelistAllowed }: { isWhitelistAllowed: boolean }) {
  const ruleRepository = new InMemoryRuleRepository();
  const whitelistUseCases = new WhitelistUseCases(new InMemoryWhitelistRepository(), ruleRepository);
  const rule = await ruleRepository.createRule({
    policyId: null,
    code: "B",
    alertType: "high_risk_country",
    alertGranularity: "transaction",
    kind: "deterministic",
    isWhitelistAllowed,
  });

  return { whitelistUseCases, rule };
}

describe("WhitelistUseCases", () => {
  it("whitelists a client for a rule that allows it", async () => {
    const { whitelistUseCases, rule } = await setUp({ isWhitelistAllowed: true });

    await whitelistUseCases.addEntry({
      ruleId: rule.id,
      clientId: "K000001",
      reason: "Ověřeno",
      createdBy: ADMIN_ID,
    });

    expect(await whitelistUseCases.listEntries(rule.id)).toEqual([
      expect.objectContaining({ ruleId: rule.id, clientId: "K000001", reason: "Ověřeno" }),
    ]);
  });

  it("refuses to whitelist a client for a rule that is mandatory by regulation", async () => {
    const { whitelistUseCases, rule } = await setUp({ isWhitelistAllowed: false });

    await expect(
      whitelistUseCases.addEntry({
        ruleId: rule.id,
        clientId: "K000001",
        reason: "Ověřeno",
        createdBy: ADMIN_ID,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("refuses to whitelist for an unknown rule", async () => {
    const { whitelistUseCases } = await setUp({ isWhitelistAllowed: true });

    await expect(
      whitelistUseCases.addEntry({
        ruleId: "missing",
        clientId: "K000001",
        reason: "Ověřeno",
        createdBy: ADMIN_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("audits a removal with the removed entry", async () => {
    const { whitelistUseCases, rule } = await setUp({ isWhitelistAllowed: true });
    await whitelistUseCases.addEntry({
      ruleId: rule.id,
      clientId: "K000001",
      reason: "Ověřeno",
      createdBy: ADMIN_ID,
    });
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    await whitelistUseCases.removeEntry({ ruleId: rule.id, clientId: "K000001" });

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining("[audit] action=whitelist_entry.removed"),
    );
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining(`"removedEntry":{"reason":"Ověřeno","createdBy":"${ADMIN_ID}"`),
    );
    consoleLog.mockRestore();
  });

  it("reports a missing entry on removal", async () => {
    const { whitelistUseCases, rule } = await setUp({ isWhitelistAllowed: true });

    await expect(
      whitelistUseCases.removeEntry({ ruleId: rule.id, clientId: "K000001" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
