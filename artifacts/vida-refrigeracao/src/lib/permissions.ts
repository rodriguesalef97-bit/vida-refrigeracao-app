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
  settings: "Configurações",
  users: "Usuários",
  permissions: "Permissões",
};

export const AREA_DESCRIPTIONS: Record<Area, string> = {
  dashboard: "Acesso ao painel inicial e indicadores",
  orders: "Criação, edição e conclusão de ordens de serviço",
  calendar: "Visualização e organização da agenda",
  employees: "Cadastro e gestão de colaboradores e técnicos",
  clients: "Cadastro e gestão de clientes",
  commercial: "Atividades comerciais e propostas",
  sales: "Registro e acompanhamento de vendas",
  financial: "Lançamentos e controle financeiro",
  reports: "Geração e visualização de relatórios",
  settings: "Configurações administrativas do sistema",
  users: "Cadastro e edição de usuários do sistema",
  permissions: "Concessão e revogação de permissões",
};

export const LEVELS = ["none", "view", "edit", "admin"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  none: "Sem acesso",
  view: "Visualizar",
  edit: "Editar",
  admin: "Administrar",
};

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  none: "O usuário não vê nem acessa esta área.",
  view: "Pode apenas visualizar os dados desta área.",
  edit: "Pode visualizar e editar/cadastrar nesta área.",
  admin: "Acesso total: visualizar, editar e configurar.",
};

const LEVEL_RANK: Record<Level, number> = {
  none: 0,
  view: 1,
  edit: 2,
  admin: 3,
};

export type AreaPermissions = Record<string, Level>;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  technician: "Técnico",
  commercial: "Comercial",
  financial: "Financeiro",
};

export function getAreaLevel(
  permissions: Record<string, string> | null | undefined,
  area: Area,
): Level {
  if (!permissions) return "none";
  const lvl = permissions[area];
  if (lvl === "view" || lvl === "edit" || lvl === "admin") return lvl;
  return "none";
}

export function hasAreaAccess(
  permissions: Record<string, string> | null | undefined,
  area: Area,
  required: Level,
): boolean {
  return LEVEL_RANK[getAreaLevel(permissions, area)] >= LEVEL_RANK[required];
}

export const AREA_GROUPS: { title: string; areas: Area[] }[] = [
  { title: "Operação", areas: ["dashboard", "orders", "calendar"] },
  { title: "Cadastros", areas: ["employees", "clients"] },
  { title: "Comercial e Financeiro", areas: ["commercial", "sales", "financial", "reports"] },
  { title: "Administração do sistema", areas: ["settings", "users", "permissions"] },
];
