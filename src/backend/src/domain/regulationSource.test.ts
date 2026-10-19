import { deriveRegulationCodeFromUrl, isAllowedRegulationSourceUrl } from "./regulationSource";

describe("isAllowedRegulationSourceUrl", () => {
  it.each([
    "https://eur-lex.europa.eu/eli/reg/2024/1624/oj",
    "https://www.zakonyprolidi.cz/cs/2008-253",
    "https://www.cnb.cz/cs/dohled-financni-trh/legislativni-zakladna/",
  ])("allows %s", (url) => {
    expect(isAllowedRegulationSourceUrl(url)).toBe(true);
  });

  it.each([
    ["plain http", "http://eur-lex.europa.eu/eli/reg/2024/1624/oj"],
    ["an unknown host", "https://example.com/aml"],
    ["a look-alike host", "https://eur-lex.europa.eu.attacker.example/aml"],
    ["a host ending like an allowed one", "https://evilcnb.cz/aml"],
    ["the instance metadata address", "https://169.254.169.254/latest/meta-data"],
    ["credentials in the URL", "https://user:secret@eur-lex.europa.eu/aml"],
    ["a non-default port", "https://eur-lex.europa.eu:8443/aml"],
    ["no URL at all", "eur-lex.europa.eu"],
  ])("refuses %s", (_case, url) => {
    expect(isAllowedRegulationSourceUrl(url)).toBe(false);
  });
});

describe("deriveRegulationCodeFromUrl", () => {
  it("is stable per URL and differs between URLs", () => {
    const code = deriveRegulationCodeFromUrl("https://www.zakonyprolidi.cz/cs/2008-253");

    expect(code).toMatch(/^URL-ZAKONYPROLIDI\.CZ-[0-9A-F]{8}$/);
    expect(deriveRegulationCodeFromUrl("https://www.zakonyprolidi.cz/cs/2008-253")).toBe(code);
    expect(deriveRegulationCodeFromUrl("https://www.zakonyprolidi.cz/cs/2017-67")).not.toBe(code);
  });
});
