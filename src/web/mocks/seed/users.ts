import { DEMO_ADMIN_USER } from "@/config/currentUser";
import type { User } from "@/features/users/types";

/** Same synthetic users and IDs as the backend migrations SeedAdminUser and SeedDemoUsers, so mock and live agree. */
export const DEMO_USERS: User[] = [
  DEMO_ADMIN_USER,
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Eva Dvořáková",
    email: "lawyer@example.com",
    roles: ["lawyer"],
  },
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
    id: "00000000-0000-4000-8000-000000000005",
    name: "Tomáš Černý",
    email: "board@example.com",
    roles: ["designated_person"],
  },
];
