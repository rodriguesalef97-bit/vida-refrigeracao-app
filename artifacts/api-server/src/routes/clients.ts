import { Router } from "express";
import { db, clientsTable, CLIENT_TYPES, CLIENT_ORIGINS } from "@workspace/db";
import { eq, desc, and, ne, or, ilike } from "drizzle-orm";
import { requireAuth, requireArea } from "../middleware/auth";

const router = Router();

type ClientRow = typeof clientsTable.$inferSelect;

function format(c: ClientRow) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, "");
}

// CPF validation (Brazilian)
function isValidCpf(raw: string): boolean {
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

// CNPJ validation (Brazilian)
function isValidCnpj(raw: string): boolean {
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

function validateDocument(
  doc: string,
  clientType: string,
): { ok: true; normalized: string } | { ok: false; error: string } {
  const d = digitsOnly(doc);
  if (clientType === "pessoa_juridica") {
    if (!isValidCnpj(d)) return { ok: false, error: "CNPJ inválido" };
  } else {
    if (!isValidCpf(d)) return { ok: false, error: "CPF inválido" };
  }
  return { ok: true, normalized: d };
}

function isValidType(t: unknown): t is (typeof CLIENT_TYPES)[number] {
  return typeof t === "string" && (CLIENT_TYPES as readonly string[]).includes(t);
}

function isValidOrigin(t: unknown): t is (typeof CLIENT_ORIGINS)[number] {
  return typeof t === "string" && (CLIENT_ORIGINS as readonly string[]).includes(t);
}

// ---------- Routes ----------

router.get("/clients", requireAuth, requireArea("clients", "view"), async (req, res) => {
  const { status, type, q } = req.query;

  let rows = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));

  if (typeof status === "string") rows = rows.filter((r) => r.status === status);
  if (typeof type === "string") rows = rows.filter((r) => r.clientType === type);
  if (typeof q === "string" && q.trim().length > 0) {
    const needle = q.trim().toLowerCase();
    const needleDigits = digitsOnly(q);
    rows = rows.filter((r) => {
      if (r.name.toLowerCase().includes(needle)) return true;
      if (r.phone && digitsOnly(r.phone).includes(needleDigits) && needleDigits.length > 0) return true;
      if (r.document.includes(needleDigits) && needleDigits.length > 0) return true;
      return false;
    });
  }

  res.json(rows.map(format));
});

router.get("/clients/search", requireAuth, requireArea("clients", "view"), async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const needle = `%${q}%`;
  const needleDigits = digitsOnly(q);
  const conditions = [ilike(clientsTable.name, needle)];
  if (needleDigits.length > 0) {
    conditions.push(ilike(clientsTable.document, `%${needleDigits}%`));
    conditions.push(ilike(clientsTable.phone, `%${needleDigits}%`));
  }
  const rows = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.status, "active"), or(...conditions)))
    .limit(30);
  // Phone column may contain formatted values; for digit-only queries also match on normalized digits.
  const filtered =
    needleDigits.length > 0
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q.toLowerCase()) ||
            r.document.includes(needleDigits) ||
            (r.phone && digitsOnly(r.phone).includes(needleDigits)),
        )
      : rows;
  res.json(filtered.slice(0, 15).map(format));
});

router.get("/clients/:id", requireAuth, requireArea("clients", "view"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const rows = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  const c = rows[0];
  if (!c) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.json(format(c));
});

function validatePhone(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Telefone inválido" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const d = digitsOnly(trimmed);
  if (d.length < 10 || d.length > 13) {
    return { ok: false, error: "Telefone deve ter DDD + número (10 ou 11 dígitos)" };
  }
  return { ok: true, value: trimmed };
}

function validateCep(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "CEP inválido" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const d = digitsOnly(trimmed);
  if (d.length !== 8) return { ok: false, error: "CEP deve conter 8 dígitos" };
  return { ok: true, value: d };
}

function validateState(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "UF inválida" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length !== 2) return { ok: false, error: "UF deve ter 2 letras" };
  return { ok: true, value: trimmed.toUpperCase() };
}

function trimOrNull(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t : null;
}

function checkMax(value: string | null, max: number, fieldLabel: string): string | null {
  if (value && value.length > max) return `${fieldLabel} excede o máximo de ${max} caracteres`;
  return null;
}

const FIELD_LIMITS = {
  email: { max: 200, label: "E-mail" },
  address: { max: 200, label: "Endereço" },
  addressNumber: { max: 20, label: "Número" },
  addressComplement: { max: 100, label: "Complemento" },
  neighborhood: { max: 100, label: "Bairro" },
  city: { max: 100, label: "Cidade" },
  location: { max: 300, label: "Localização" },
  notes: { max: 2000, label: "Observação" },
} as const;

type LimitedField = keyof typeof FIELD_LIMITS;

function validateLimitedFields(
  body: Record<string, unknown>,
  fields: LimitedField[],
): { ok: true; values: Partial<Record<LimitedField, string | null>> } | { ok: false; error: string } {
  const values: Partial<Record<LimitedField, string | null>> = {};
  for (const f of fields) {
    if (body[f] === undefined) continue;
    const v = trimOrNull(body[f]);
    const err = checkMax(v, FIELD_LIMITS[f].max, FIELD_LIMITS[f].label);
    if (err) return { ok: false, error: err };
    values[f] = v;
  }
  return { ok: true, values };
}

router.post("/clients", requireAuth, requireArea("clients", "edit"), async (req, res) => {
  const b = req.body ?? {};

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 2) {
    res.status(400).json({ error: "Nome / razão social é obrigatório (mín. 2 caracteres)" });
    return;
  }
  if (name.length > 200) {
    res.status(400).json({ error: "Nome muito longo (máx. 200 caracteres)" });
    return;
  }
  if (b.clientType !== undefined && !isValidType(b.clientType)) {
    res.status(400).json({ error: "Tipo de cliente inválido" });
    return;
  }
  const clientType = isValidType(b.clientType) ? b.clientType : "pessoa_fisica";
  if (b.status !== undefined && b.status !== "active" && b.status !== "inactive") {
    res.status(400).json({ error: "Status inválido" });
    return;
  }
  if (b.origin !== undefined && !isValidOrigin(b.origin)) {
    res.status(400).json({ error: "Origem inválida" });
    return;
  }
  const documentRaw = typeof b.document === "string" ? b.document : "";
  if (!documentRaw) {
    res.status(400).json({ error: "CPF / CNPJ é obrigatório" });
    return;
  }
  const v = validateDocument(documentRaw, clientType);
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }

  // Duplicate by document
  const dupDoc = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.document, v.normalized))
    .limit(1);
  if (dupDoc.length > 0) {
    res.status(400).json({ error: "Já existe um cliente com este CPF/CNPJ" });
    return;
  }

  const phoneR = validatePhone(b.phone);
  if (!phoneR.ok) { res.status(400).json({ error: phoneR.error }); return; }
  const cepR = validateCep(b.cep);
  if (!cepR.ok) { res.status(400).json({ error: cepR.error }); return; }
  const stateR = validateState(b.state);
  if (!stateR.ok) { res.status(400).json({ error: stateR.error }); return; }

  // Duplicate by phone (block if exact match on digits)
  if (phoneR.value) {
    const phoneDigits = digitsOnly(phoneR.value);
    if (phoneDigits.length >= 10) {
      const all = await db.select().from(clientsTable);
      const dup = all.find((c) => c.phone && digitsOnly(c.phone) === phoneDigits);
      if (dup) {
        res.status(400).json({
          error: `Telefone já cadastrado para o cliente "${dup.name}"`,
        });
        return;
      }
    }
  }

  const origin = isValidOrigin(b.origin) ? b.origin : "manual";

  const limited = validateLimitedFields(b, [
    "email", "address", "addressNumber", "addressComplement",
    "neighborhood", "city", "location", "notes",
  ]);
  if (!limited.ok) { res.status(400).json({ error: limited.error }); return; }

  const [created] = await db
    .insert(clientsTable)
    .values({
      name,
      clientType,
      document: v.normalized,
      phone: phoneR.value,
      email: limited.values.email ?? null,
      cep: cepR.value,
      address: limited.values.address ?? null,
      addressNumber: limited.values.addressNumber ?? null,
      addressComplement: limited.values.addressComplement ?? null,
      neighborhood: limited.values.neighborhood ?? null,
      city: limited.values.city ?? null,
      state: stateR.value,
      location: limited.values.location ?? null,
      notes: limited.values.notes ?? null,
      status: b.status === "inactive" ? "inactive" : "active",
      origin,
    })
    .returning();
  res.status(201).json(format(created!));
});

router.put("/clients/:id", requireAuth, requireArea("clients", "edit"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const existing = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const cur = existing[0]!;
  const b = req.body ?? {};

  const updates: Partial<typeof clientsTable.$inferInsert> = { updatedAt: new Date() };

  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (n.length < 2) {
      res.status(400).json({ error: "Nome / razão social é obrigatório (mín. 2 caracteres)" });
      return;
    }
    if (n.length > 200) {
      res.status(400).json({ error: "Nome muito longo (máx. 200 caracteres)" });
      return;
    }
    updates.name = n;
  }
  let nextType = cur.clientType;
  if (b.clientType !== undefined) {
    if (!isValidType(b.clientType)) {
      res.status(400).json({ error: "Tipo de cliente inválido" });
      return;
    }
    nextType = b.clientType;
    updates.clientType = b.clientType;
  }
  if (b.document !== undefined) {
    const v = validateDocument(String(b.document), nextType);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    if (v.normalized !== cur.document) {
      const dup = await db
        .select()
        .from(clientsTable)
        .where(and(eq(clientsTable.document, v.normalized), ne(clientsTable.id, id)))
        .limit(1);
      if (dup.length > 0) {
        res.status(400).json({ error: "Já existe um cliente com este CPF/CNPJ" });
        return;
      }
    }
    updates.document = v.normalized;
  } else if (nextType !== cur.clientType) {
    // clientType changed without a new document: re-validate existing document against the new type.
    const v = validateDocument(cur.document, nextType);
    if (!v.ok) {
      res.status(400).json({
        error: `Documento atual incompatível com o novo tipo. Informe um ${nextType === "pessoa_juridica" ? "CNPJ" : "CPF"} válido.`,
      });
      return;
    }
  }
  if (b.phone !== undefined) {
    const phoneR = validatePhone(b.phone);
    if (!phoneR.ok) { res.status(400).json({ error: phoneR.error }); return; }
    if (phoneR.value) {
      const phoneDigits = digitsOnly(phoneR.value);
      if (phoneDigits.length >= 10 && digitsOnly(cur.phone ?? "") !== phoneDigits) {
        const all = await db.select().from(clientsTable);
        const dup = all.find(
          (c) => c.id !== id && c.phone && digitsOnly(c.phone) === phoneDigits,
        );
        if (dup) {
          res.status(400).json({
            error: `Telefone já cadastrado para o cliente "${dup.name}"`,
          });
          return;
        }
      }
    }
    updates.phone = phoneR.value;
  }
  if (b.cep !== undefined) {
    const cepR = validateCep(b.cep);
    if (!cepR.ok) { res.status(400).json({ error: cepR.error }); return; }
    updates.cep = cepR.value;
  }
  if (b.state !== undefined) {
    const stateR = validateState(b.state);
    if (!stateR.ok) { res.status(400).json({ error: stateR.error }); return; }
    updates.state = stateR.value;
  }
  const limited = validateLimitedFields(b, [
    "email", "address", "addressNumber", "addressComplement",
    "neighborhood", "city", "location", "notes",
  ]);
  if (!limited.ok) { res.status(400).json({ error: limited.error }); return; }
  for (const k of Object.keys(limited.values) as LimitedField[]) {
    (updates as Record<string, unknown>)[k] = limited.values[k] ?? null;
  }
  if (b.status !== undefined) {
    if (b.status !== "active" && b.status !== "inactive") {
      res.status(400).json({ error: "Status inválido" });
      return;
    }
    updates.status = b.status;
  }
  if (b.origin !== undefined) {
    if (!isValidOrigin(b.origin)) {
      res.status(400).json({ error: "Origem inválida" });
      return;
    }
    updates.origin = b.origin;
  }

  const [updated] = await db
    .update(clientsTable)
    .set(updates)
    .where(eq(clientsTable.id, id))
    .returning();
  res.json(format(updated!));
});

router.delete("/clients/:id", requireAuth, requireArea("clients", "edit"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const result = await db.delete(clientsTable).where(eq(clientsTable.id, id)).returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.json({ message: "Cliente removido com sucesso" });
});

export default router;
