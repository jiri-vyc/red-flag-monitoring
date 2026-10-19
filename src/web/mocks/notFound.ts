import { ApiError } from "@/lib/apiError";

export function throwMockNotFound(entityName: string, entityId: string): never {
  throw new ApiError({
    kind: "not_found",
    status: 404,
    message: `${entityName} "${entityId}" was not found in mock data.`,
  });
}
