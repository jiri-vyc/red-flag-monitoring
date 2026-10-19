import type { EvaluationRun } from "../../domain/evaluation";
import { NotImplementedError } from "../errors";

export class EvaluationRunUseCases {
  // TODO(#3): run the active enabled rules over the transactions and store the run (D18, V5, V14).
  startRun(): Promise<EvaluationRun> {
    return Promise.reject(new NotImplementedError("The evaluation engine is not implemented yet"));
  }
}
