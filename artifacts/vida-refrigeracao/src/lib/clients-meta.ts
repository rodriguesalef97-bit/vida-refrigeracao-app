export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function digitsOnly(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function formatCpfCnpj(value: string | null | undefined): string {
  const d = digitsOnly(value);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return value ?? "";
}

export function formatPhone(value: string | null | undefined): string {
  const d = digitsOnly(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value ?? "";
}

export function formatCep(value: string | null | undefined): string {
  const d = digitsOnly(value);
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return value ?? "";
}

export function isValidCpf(raw: string): boolean {
  const cpf = digitsOnly(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]!, 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9]!, 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]!, 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]!, 10);
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = digitsOnly(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(base[i]!, 10) * weights[i]!;
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj, w1);
  if (d1 !== parseInt(cnpj[12]!, 10)) return false;
  const d2 = calc(cnpj, w2);
  return d2 === parseInt(cnpj[13]!, 10);
}

export function clientTypeLabel(t: string): string {
  return t === "pessoa_juridica" ? "Pessoa Jurídica" : "Pessoa Física";
}

export function buildFullAddress(c: {
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const parts: string[] = [];
  if (c.address) {
    parts.push(c.addressNumber ? `${c.address}, ${c.addressNumber}` : c.address);
  }
  if (c.addressComplement) parts.push(c.addressComplement);
  if (c.neighborhood) parts.push(c.neighborhood);
  if (c.city) parts.push(c.state ? `${c.city} - ${c.state}` : c.city);
  else if (c.state) parts.push(c.state);
  return parts.join(", ");
}
