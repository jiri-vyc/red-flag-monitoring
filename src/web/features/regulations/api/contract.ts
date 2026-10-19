import type { Regulation } from "../types";

export interface RegulationsService {
  loadRegulations(): Promise<Regulation[]>;
  loadRegulation(regulationId: string): Promise<Regulation>;
}
