import type { DataSource } from "typeorm";

import type { UserRepository } from "../../../application/users/userRepository";
import type { User } from "../../../domain/user";
import { UserEntity } from "../entities/UserEntity";

export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listUsers(): Promise<User[]> {
    const entities = await this.dataSource.getRepository(UserEntity).find({ order: { name: "ASC" } });

    return entities.map(toUser);
  }
}

function toUser(entity: UserEntity): User {
  return { id: entity.id, name: entity.name, email: entity.email, roles: entity.roles };
}
