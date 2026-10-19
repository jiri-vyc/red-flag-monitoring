import { fireEvent, render, screen } from "@testing-library/react";

import { useRegulations } from "@/features/regulations/api/hooks";
import type { Regulation } from "@/features/regulations/types";
import { I18nProvider } from "@/i18n/I18nProvider";

import { SourceStep } from "./SourceStep";

jest.mock("@/features/regulations/api/hooks", () => ({ useRegulations: jest.fn() }));

// jsdom has no Blob.text(); the browser reads the file header with it.
if (!Blob.prototype.text) {
  Blob.prototype.text = function readBlobText(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

const VYHL67: Regulation = {
  id: "reg-vyhl67",
  name: "Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad",
  shortName: "VYHL67",
  jurisdiction: "CZ",
  description: "",
  sourceUrl: "https://e-sbirka.gov.cz/sb/2018/67",
  version: "",
  lastCheckedAt: "",
  keyProvisions: [],
  policyIds: [],
  ruleIds: [],
};

const DECREE_FILE = new File(
  [
    "# Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad\n\n> **Znění:** účinné od 30. 12. 2024\n",
  ],
  "vyhlaska-cnb-67-2018.md",
  { type: "text/markdown" },
);
const FATF_FILE = new File(
  ["# The FATF Recommendations\n\n> **Zdroj:** https://www.fatf-gafi.org/recommendations\n"],
  "fatf-recommendations.md",
  { type: "text/markdown" },
);

const findUseExistingButton = () => screen.findByRole("button", { name: "Use existing regulation VYHL67" });
const newWordingNotice = () => screen.queryByText("New wording of an existing regulation");
const codeField = () => screen.queryByLabelText("Regulation code");

function renderSourceStep() {
  render(
    <I18nProvider initialLocale="en">
      <SourceStep
        existingRegulation={null}
        capabilities={{ isAvailable: true, canFetchUrl: false }}
        onSubmit={jest.fn()}
      />
    </I18nProvider>,
  );
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText("Regulation file"), { target: { files: [file] } });
}

async function pickExistingRegulationForDecree() {
  chooseFile(DECREE_FILE);
  fireEvent.click(await findUseExistingButton());
  expect(newWordingNotice()).not.toBeNull();
  expect(codeField()).toBeNull();
}

describe("SourceStep document suggestion", () => {
  beforeEach(() => {
    jest.mocked(useRegulations).mockReturnValue({ data: [VYHL67] } as ReturnType<typeof useRegulations>);
  });

  it("drops the existing regulation picked for one file when another file is chosen", async () => {
    renderSourceStep();
    await pickExistingRegulationForDecree();

    chooseFile(FATF_FILE);

    expect(await screen.findByText("The FATF Recommendations")).not.toBeNull();
    expect(newWordingNotice()).toBeNull();
    expect(codeField()).not.toBeNull();
  });

  it("drops the picked regulation on a switch to another source tab and back", async () => {
    renderSourceStep();
    await pickExistingRegulationForDecree();

    fireEvent.click(screen.getByRole("radio", { name: "Paste text" }));
    expect(newWordingNotice()).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "File (MD)" }));

    expect(await findUseExistingButton()).not.toBeNull();
    expect(newWordingNotice()).toBeNull();
    expect(codeField()).not.toBeNull();
  });

  it("keeps an edit made after filling when the fill is undone", async () => {
    renderSourceStep();
    chooseFile(DECREE_FILE);
    fireEvent.click(await screen.findByRole("button", { name: "Fill in the fields" }));
    fireEvent.change(screen.getByLabelText("Regulation code"), { target: { value: "VYHL" } });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByLabelText<HTMLInputElement>("Regulation code").value).toBe("VYHL");
    expect(screen.getByLabelText<HTMLInputElement>("Regulation title").value).toBe("");
  });
});
