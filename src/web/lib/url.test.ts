import { isHttpUrl, toSafeSourceUrl } from "./url";

const UNSAFE_URLS = [
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "ftp://example.com",
  "",
];

describe("isHttpUrl", () => {
  it.each(["https://eur-lex.europa.eu/eli/reg/2024/1624/oj", "http://example.com"])("accepts %s", (url) => {
    expect(isHttpUrl(url)).toBe(true);
  });

  it.each(UNSAFE_URLS)("rejects %p", (url) => {
    expect(isHttpUrl(url)).toBe(false);
  });
});

describe("toSafeSourceUrl", () => {
  it("keeps an http(s) URL", () => {
    expect(toSafeSourceUrl("https://www.zakonyprolidi.cz/cs/2008-253")).toBe(
      "https://www.zakonyprolidi.cz/cs/2008-253",
    );
  });

  it.each([...UNSAFE_URLS, null, undefined])("drops %p", (url) => {
    expect(toSafeSourceUrl(url)).toBe("");
  });
});
