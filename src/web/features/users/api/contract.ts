import type { User } from "../types";

export interface UsersService {
  loadUsers(): Promise<User[]>;
}
