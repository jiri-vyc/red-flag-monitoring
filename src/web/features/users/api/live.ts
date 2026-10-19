import { z } from "zod";

import { requestJson } from "@/lib/httpClient";

import { userSchema } from "../types";
import type { UsersService } from "./contract";

export const liveUsersService: UsersService = {
  loadUsers() {
    return requestJson({ path: "/users", schema: z.array(userSchema) });
  },
};
