export const AREAS = [
  "dashboard",
  "orders",
  "calendar",
  "employees",
  "clients",
  "commercial",
  "sales",
  "financial",
  "reports",
  "awards",
  "settings",
  "users",
  "permissions",
] as const;

export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  dashboard: "Painel inicial",
  orders: "Ordens de Serviço",
  calendar: "Agenda",
  employees: "Equipe / Colaboradores",
  clients: "Clientes",
  commercial: "Comercial",
  sales: "Vendas",
  financial: "Financeiro",
  reports: "Relatórios",
  awards: "Premiações",
  settings: "Configurações",
  users: "Usuários",
  permissions: "Permissões",
};

export const LEVELS = ["none", "view", "edit", "admin"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  none: "Sem acesso",
  view: "Visualizar",
  edit: "Editar",
  admin: "Administrar",
};

const LEVEL_RANK: Record<Level, number> = {
  none: 0,
  view: 1,
  edit: 2,
  admin: 3,
};

export type AreaPermissions = Record<Area, Level>;

function emptyAreaPermissions(): AreaPermissions {
  const out = {} as AreaPermissions;
  for (const a of AREAS) out[a] = "none";
  return out;
}

function withAreas(overrides: Partial<AreaPermissions>): AreaPermissions {
  return { ...emptyAreaPermissions(), ...overrides };
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  technician: "Técnico",
  commercial: "Comercial",
  financial: "Financeiro",
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, AreaPermissions> = {
  admin: AREAS.reduce((acc, a) => ({ ...acc, [a]: "admin" }), {} as AreaPermissions),
  technician: withAreas({
    dashboard: "view",
    orders: "edit",
    calendar: "view",
    awards: "view",
  }),
  commercial: withAreas({
    dashboard: "view",
    orders: "view",
    calendar: "view",
    clients: "edit",
    commercial: "edit",
    sales: "edit",
    awards: "view",
  }),
  financial: withAreas({
    dashboard: "view",
    orders: "view",
    calendar: "view",
    financial: "edit",
    reports: "view",
    awards: "view",
  }),
};

export function getDefaultPermissionsForRole(role: string): AreaPermissions {
  return ROLE_DEFAULT_PERMISSIONS[role] ?? withAreas({ dashboard: "view" });
}

function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}

function isArea(v: unknown): v is Area {
  return typeof v === "string" && (AREAS as readonly string[]).includes(v);
}

/**
 * Returns the effective per-area permission map for a user.
 * Stored permissions are validated; unknown areas/levels are dropped.
 * If the stored shape is the legacy boolean map, it is ignored and the
 * role defaults are used (forces a clean reset on next save).
 */
export function getEffectivePermissions(user: {
  role: string;
  permissions?: Record<string, unknown> | null;
}): AreaPermissions {
  const base = getDefaultPermissionsForRole(user.role);
  const stored = user.permissions;
  if (!stored || typeof stored !== "object") return base;

  // Detect legacy format (boolean values) and ignore.
  const sample = Object.values(stored)[0];
  if (typeof sample === "boolean") return base;

  const merged: AreaPermissions = { ...base };
  for (const [k, v] of Object.entries(stored)) {
    if (isArea(k) && isLevel(v)) merged[k] = v;
  }
  return merged;
}

export function hasAreaAccess(
  user: { role: string; permissions?: Record<string, unknown> | null } | null | undefined,
  area: Area,
  required: Level,
): boolean {
  if (!user) return false;
  const perms = getEffectivePermissions(user);
  return LEVEL_RANK[perms[area]] >= LEVEL_RANK[required];
}

/**
 * Validates and normalizes a permissions object for storage.
 * Accepts only known areas with valid level values; everything else is dropped.
 * Returns null if input is null/undefined (meaning "use role defaults").
 */
export function normalizePermissions(input: unknown): AreaPermissions | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object") return null;
  const out = {} as AreaPermissions;
  for (const a of AREAS) out[a] = "none";
  let any = false;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (isArea(k) && isLevel(v)) {
      out[k] = v;
      any = true;
    }
  }
  return any ? out : null;
}

// Backward-compat: legacy single-key boolean check kept for code that hasn't migrated yet.
// Maps a legacy permission key to (area, level) and delegates to hasAreaAccess.
const LEGACY_KEY_MAP: Record<string, { area: Area; level: Level }> = {
  view_dashboard: { area: "dashboard", level: "view" },
  view_orders: { area: "orders", level: "view" },
  edit_orders: { area: "orders", level: "edit" },
  complete_orders: { area: "orders", level: "edit" },
  view_calendar: { area: "calendar", level: "view" },
  edit_calendar: { area: "calendar", level: "edit" },
  view_employees: { area: "employees", level: "view" },
  edit_employees: { area: "employees", level: "edit" },
  view_clients: { area: "clients", level: "view" },
  edit_clients: { area: "clients", level: "edit" },
  view_financial: { area: "financial", level: "view" },
  edit_financial: { area: "financial", level: "edit" },
  view_sales: { area: "sales", level: "view" },
  edit_sales: { area: "sales", level: "edit" },
  view_commercial: { area: "commercial", level: "view" },
  edit_commercial: { area: "commercial", level: "edit" },
  view_reports: { area: "reports", level: "view" },
  manage_users: { area: "users", level: "admin" },
  manage_permissions: { area: "permissions", level: "admin" },
  admin_settings: { area: "settings", level: "admin" },
};

export type PermissionKey = keyof typeof LEGACY_KEY_MAP;
export const PERMISSION_KEYS = Object.keys(LEGACY_KEY_MAP) as PermissionKey[];

export function hasPermission(
  user: { role: string; permissions?: Record<string, unknown> | null } | null | undefined,
  key: PermissionKey,
): boolean {
  const m = LEGACY_KEY_MAP[key];
  if (!m) return false;
  return hasAreaAccess(user, m.area, m.level);
}
