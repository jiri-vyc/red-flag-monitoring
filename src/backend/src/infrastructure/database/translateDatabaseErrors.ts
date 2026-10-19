import type { DatabaseError } from "pg";
import { QueryFailedError } from "typeorm";

import { BusinessRuleViolationError, ConflictError, MissingReferenceError } from "../../application/errors";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

// Constraint violations are expected outcomes of a write (duplicate code, unknown user, …); everything else
// propagates unchanged and ends as a 500.
export async function translateDatabaseErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw translateDatabaseError(error);
  }
}

function translateDatabaseError(error: unknown): unknown {
  if (!(error instanceof QueryFailedError)) {
    return error;
  }

  const { code, constraint, detail } = error.driverError as DatabaseError;
  const description = `${constraint ?? "constraint"}${detail ? `: ${detail}` : ""}`;

  switch (code) {
    case UNIQUE_VIOLATION:
      return new ConflictError(`Already exists, ${description}`, { cause: error });
    case FOREIGN_KEY_VIOLATION:
      return new MissingReferenceError(`Referenced row does not exist, ${description}`, { cause: error });
    case CHECK_VIOLATION:
      return new BusinessRuleViolationError(`Violates ${description}`, { cause: error });
    default:
      return error;
  }
}
