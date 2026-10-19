import type { MigrationInterface, QueryRunner } from "typeorm";

// Issue #6: synthetic demo users (no real people) so every role has a user and one user holds several roles.
// Fixed IDs, because the web's mock mode and the user switcher refer to them.
type DemoUser = { id: string; name: string; email: string; roles: string[] };

export const DEMO_USERS: DemoUser[] = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Jana Nováková",
    email: "analyst@example.com",
    roles: ["compliance_analyst"],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Petr Svoboda",
    email: "compliance@example.com",
    roles: ["compliance_officer", "contact_person"],
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Eva Dvořáková",
    email: "lawyer@example.com",
    roles: ["lawyer"],
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "Tomáš Černý",
    email: "board@example.com",
    roles: ["designated_person"],
  },
];

export class SeedDemoUsers1792451291505 implements MigrationInterface {
  name = "SeedDemoUsers1792451291505";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const user of DEMO_USERS) {
      await queryRunner.query(
        `INSERT INTO "users" ("id", "name", "email", "roles") VALUES ($1, $2, $3, $4)`,
        [user.id, user.name, user.email, user.roles],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [DEMO_USERS.map((user) => user.id)]);
  }
}
