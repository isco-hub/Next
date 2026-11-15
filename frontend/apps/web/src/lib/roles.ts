import type { Role } from "@nextcrop/api-client";

export const ROLE_HOME: Record<Role, string> = {
  farmer: "/farmer",
  extension_officer: "/extension",
  cooperative: "/cooperative",
  agronomist: "/agronomist",
  admin: "/admin/dashboard",
};

export const roleHome = (role: Role): string => ROLE_HOME[role];
