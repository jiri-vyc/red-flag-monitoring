import type { UsersService } from "@/features/users/api/contract";
import { DEMO_USERS } from "@/mocks/seed/users";

import { simulateLatency } from "../latency";

export const mockUsersService: UsersService = {
  async loadUsers() {
    await simulateLatency();
    return DEMO_USERS;
  },
};
