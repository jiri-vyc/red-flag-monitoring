import type { User } from "../../domain/user";

export interface UserRepository {
  // Sorted by name.
  listUsers(): Promise<User[]>;
}
