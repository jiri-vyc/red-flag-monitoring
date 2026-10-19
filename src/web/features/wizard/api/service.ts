import { resolveService } from "@/config/apiMode";
import { mockWizardService } from "@/mocks/services/wizard.mock";

import type { WizardService } from "./contract";
import { liveWizardService } from "./live";

export const wizardService = resolveService<WizardService>("wizard", {
  mock: mockWizardService,
  live: liveWizardService,
});
