export const SECTOR_OPTIONS = [
  { value: "producao_operacional", label: "Produção Operacional" },
  { value: "comercial", label: "Comercial" },
  { value: "vendas", label: "Vendas" },
  { value: "financeiro", label: "Financeiro" },
  { value: "administrador_principal", label: "Administrador Principal" },
] as const;

export const ROLE_OPTIONS = [
  { value: "tecnico", label: "Técnico" },
  { value: "ajudante", label: "Ajudante" },
  { value: "supervisor", label: "Supervisor" },
  { value: "comercial", label: "Comercial" },
  { value: "vendedor", label: "Vendedor" },
  { value: "financeiro", label: "Financeiro" },
  { value: "administrador", label: "Administrador" },
] as const;

export const TECHNICIAN_ROLES = new Set(["tecnico", "ajudante", "supervisor"]);

export function sectorLabel(value: string | null | undefined): string {
  return SECTOR_OPTIONS.find((s) => s.value === value)?.label ?? value ?? "";
}

export function roleLabel(value: string | null | undefined): string {
  return ROLE_OPTIONS.find((r) => r.value === value)?.label ?? value ?? "";
}

export function formatBirthdayBR(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function shortBirthday(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}`;
}
