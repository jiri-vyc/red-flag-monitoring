import { extractHtmlTitle, htmlToText } from "./htmlToText";

describe("htmlToText", () => {
  it("keeps paragraphs as lines and drops markup, scripts and navigation", () => {
    const html = `<html><head><title>AML</title><style>p{}</style></head><body>
      <nav>Menu</nav><h1>Zákon&nbsp;č.&nbsp;253/2008 Sb.</h1>
      <p>&sect;&nbsp;21 <b>Systém</b> vnitřních zásad</p><script>alert(1)</script>
      <table><tr><td>a</td><td>b</td></tr></table><!-- comment --></body></html>`;

    expect(htmlToText(html)).toBe("Zákon č. 253/2008 Sb.\n\n§ 21 Systém vnitřních zásad\n\na b");
  });

  it("decodes numeric entities and never turns decoded text into markup", () => {
    expect(htmlToText("<p>&#167; 1 &#x2013; &lt;b&gt;</p>")).toBe("§ 1 – <b>");
  });
});

describe("extractHtmlTitle", () => {
  it("returns the decoded page title", () => {
    expect(extractHtmlTitle("<title> Nařízení (EU) 2024/1624 &ndash; EUR-Lex </title>")).toBe(
      "Nařízení (EU) 2024/1624 – EUR-Lex",
    );
  });

  it("returns null without a title", () => {
    expect(extractHtmlTitle("<p>text</p>")).toBeNull();
  });
});
