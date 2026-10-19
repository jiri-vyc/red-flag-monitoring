import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockUsersService } from "@/mocks/services/users.mock";

import type { UsersService } from "./contract";
import { liveUsersService } from "./live";

export const usersImplementations: ServiceImplementations<UsersService> = {
  mock: mockUsersService,
  live: liveUsersService,
};

export const usersService = resolveService("users", usersImplementations);
