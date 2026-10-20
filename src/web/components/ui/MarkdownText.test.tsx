import { render, screen } from "@testing-library/react";

import { MarkdownText } from "./MarkdownText";

const POLICY_MARKDOWN = `# Vnitřní předpis

Úvodní odstavec s **důrazem**.

- čl. 1 Identifikace klienta
- čl. 2 Kontrola PEP

| Článek | Téma |
| --- | --- |
| čl. 3 | Hotovostní platby |

[Zdroj](https://e-sbirka.gov.cz/sb/2018/67)

<script>alert("x")</script>
<b>tučně</b>
`;

describe("MarkdownText", () => {
  it("renders headings, lists, tables and links", () => {
    render(<MarkdownText>{POLICY_MARKDOWN}</MarkdownText>);

    expect(screen.getByRole("heading", { name: "Vnitřní předpis" })).not.toBeNull();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "čl. 1 Identifikace klienta",
      "čl. 2 Kontrola PEP",
    ]);
    expect(screen.getByRole("table")).not.toBeNull();
    expect(screen.getByRole("cell", { name: "Hotovostní platby" })).not.toBeNull();

    const link = screen.getByRole("link", { name: "Zdroj" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not render raw HTML as elements", () => {
    const { container } = render(<MarkdownText>{POLICY_MARKDOWN}</MarkdownText>);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("drops javascript: URLs", () => {
    render(<MarkdownText>{"[klik](javascript:alert(1))"}</MarkdownText>);

    expect(screen.getByText("klik").getAttribute("href") ?? "").not.toContain("javascript");
  });
});
