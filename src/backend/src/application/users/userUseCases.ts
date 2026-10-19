import type { User } from "../../domain/user";
import type { UserRepository } from "./userRepository";

// Issue #6: read-only; without auth (M12) the web picks the current user and role from this list.
export class UserUseCases {
  constructor(private readonly userRepository: UserRepository) {}

  listUsers(): Promise<User[]> {
    return this.userRepository.listUsers();
  }
}
