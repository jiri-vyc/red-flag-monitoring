import {
  getServiceMode,
  resolveService,
  selectServiceImplementation,
  type ApiMode,
  type ServiceImplementations,
  type ServiceName,
} from "@/config/apiMode";
import { mockWizardService } from "@/mocks/services/wizard.mock";

import type { WizardCapabilities, WizardService } from "./contract";
import { liveWizardService } from "./live";

// The wizard creates and edits regulations, policies and rules, so it must use the same data source as they do:
// it is available when all of them are live, or all of them are mocked.
const WIZARD_DATA_SERVICES: readonly ServiceName[] = ["regulations", "policies", "rules"];

const wizardImplementations: ServiceImplementations<WizardService> = {
  mock: mockWizardService,
  live: liveWizardService,
};

export const wizardService = resolveService("wizard", wizardImplementations);

export function getWizardCapabilities(globalApiMode: ApiMode): WizardCapabilities {
  const wizardMode = getServiceMode("wizard", globalApiMode);
  const isDataSourceShared = WIZARD_DATA_SERVICES.every(
    (serviceName) => getServiceMode(serviceName, globalApiMode) === wizardMode,
  );
  const { capabilities } = selectServiceImplementation("wizard", wizardImplementations, globalApiMode);
  return { ...capabilities, isAvailable: capabilities.isAvailable && isDataSourceShared };
}
