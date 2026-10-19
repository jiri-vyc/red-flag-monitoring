import { requestJson } from "@/lib/httpClient";

import { liveBatchesService } from "./live";

jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));

describe("liveBatchesService", () => {
  it("hides the CSV upload (BE-01) and keeps throwing unsupported without calling the API", async () => {
    expect(liveBatchesService.capabilities.canUploadBatch).toBe(false);
    await expect(
      liveBatchesService.uploadBatch({ file: new File(["a;b"], "batch.csv"), uploadedBy: "analyst" }),
    ).rejects.toMatchObject({ kind: "unsupported" });
    expect(requestJson).not.toHaveBeenCalled();
  });
});
