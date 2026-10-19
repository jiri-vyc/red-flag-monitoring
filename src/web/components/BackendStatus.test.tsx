import { render, screen } from "@testing-library/react";

import { BackendStatus } from "./BackendStatus";

describe("BackendStatus", () => {
  it("shows the reported status when the backend is reachable", () => {
    render(<BackendStatus health={{ isReachable: true, status: "ok" }} />);

    expect(screen.getByRole("status").textContent).toBe("Backend: ok");
  });

  it("shows unreachable when the backend cannot be reached", () => {
    render(<BackendStatus health={{ isReachable: false }} />);

    expect(screen.getByRole("status").textContent).toBe("Backend: unreachable");
  });
});
