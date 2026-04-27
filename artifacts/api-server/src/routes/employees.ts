import { Router } from "express";
import { db, employeesTable, usersTable, SECTORS, ROLES, getDefaultPermissionsForRole } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireArea } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

type EmployeeRow = typeof employeesTable.$inferSelect;

function formatEmployee(e: EmployeeRow) {
  return {
    ...e,
    email: e.email ?? null,
    phone: e.phone ?? null,
    cpf: e.cpf ?? null,
    birthDate: e.birthDate ?? null,
    notes: e.notes ?? null,
    userId: e.userId ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function isValidSector(s: unknown): s is (typeof SECTORS)[number] {
  return typeof s === "string" && (SECTORS as readonly string[]).includes(s);
}
function isValidRole(s: unknown): s is (typeof ROLES)[number] {
  return typeof s === "string" && (ROLES as readonly string[]).includes(s);
}

// Compute MM-DD from an ISO/date string (YYYY-MM-DD), tolerant to bad input
function toMonthDay(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return `${m[2]}-${m[3]}`;
}

router.get("/employees", requireArea("employees", "view"), async (req, res) => {
  const { status, sector, role } = req.query;

  let rows = await db
    .select()
    .from(employeesTable)
    .orderBy(desc(employeesTable.createdAt));

  if (typeof status === "string") {
    rows = rows.filter((r) => r.status === status);
  }
  if (typeof sector === "string") {
    rows = rows.filter((r) => r.sector === sector);
  }
  if (typeof role === "string") {
    rows = rows.filter((r) => r.role === role);
  }

  res.json(rows.map(formatEmployee));
});

router.get("/employees/technicians", requireArea("orders", "view"), async (_req, res) => {
  const TECH_ROLES = ["tecnico", "ajudante", "supervisor"];
  const rows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));
  const techs = rows
    .filter((r) => TECH_ROLES.includes(r.role))
    .map((r) => ({ id: r.id, fullName: r.fullName, role: r.role }));
  res.json(techs);
});

router.get("/employees/birthdays/today", requireArea("dashboard", "view"), async (_req, res) => {
  const rows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));

  const today = new Date();
  const todayMD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  const result = rows
    .filter((r) => toMonthDay(r.birthDate) === todayMD)
    .map(formatEmployee);

  res.json(result);
});

router.get("/employees/birthdays/month", requireArea("dashboard", "view"), async (req, res) => {
  const monthParam = Number(req.query.month);
  const rows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));

  const targetMonth = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
    ? monthParam
    : new Date().getMonth() + 1;

  const targetMM = String(targetMonth).padStart(2, "0");

  const result = rows
    .filter((r) => {
      const md = toMonthDay(r.birthDate);
      return md !== null && md.startsWith(targetMM);
    })
    .map(formatEmployee)
    .sort((a, b) => {
      const aMD = toMonthDay(a.birthDate) ?? "";
      const bMD = toMonthDay(b.birthDate) ?? "";
      return aMD.localeCompare(bMD);
    });

  res.json(result);
});

router.get("/employees/:id", requireArea("employees", "view"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const rows = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
  const e = rows[0];
  if (!e) {
    res.status(404).json({ error: "Colaborador não encontrado" });
    return;
  }
  res.json(formatEmployee(e));
});

router.post("/employees", requireArea("employees", "edit"), async (req, res) => {
  const {
    fullName,
    email,
    phone,
    cpf,
    birthDate,
    sector,
    role,
    status,
    notes,
    createUser,
    username,
    password,
  } = req.body ?? {};

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    res.status(400).json({ error: "Nome completo é obrigatório" });
    return;
  }
  if (sector && !isValidSector(sector)) {
    res.status(400).json({ error: "Setor inválido" });
    return;
  }
  if (role && !isValidRole(role)) {
    res.status(400).json({ error: "Função inválida" });
    return;
  }

  let linkedUserId: number | null = null;

  if (createUser) {
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Usuário e senha são obrigatórios para criar acesso" });
      return;
    }
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Nome de usuário já está em uso" });
      return;
    }
    // Conservative mapping: most employee roles get the minimum-access "technician"
    // profile. The administrator must explicitly elevate access via the Permissions
    // panel so new users never receive unintended privileges.
    const userRoleMap: Record<string, string> = {
      administrador: "admin",
      financeiro: "financial",
      // tecnico, supervisor, comercial, vendedor, ajudante -> technician (minimal)
    };
    const mappedUserRole = role && isValidRole(role) ? userRoleMap[role] ?? "technician" : "technician";
    const [created] = await db
      .insert(usersTable)
      .values({
        username: username.trim(),
        password,
        name: fullName.trim(),
        role: mappedUserRole,
      })
      .returning();
    linkedUserId = created.id;
  }

  const [employee] = await db
    .insert(employeesTable)
    .values({
      fullName: fullName.trim(),
      email: email ?? null,
      phone: phone ?? null,
      cpf: cpf ?? null,
      birthDate: birthDate ?? null,
      sector: sector ?? "producao_operacional",
      role: role ?? "tecnico",
      status: status === "inactive" ? "inactive" : "active",
      notes: notes ?? null,
      userId: linkedUserId,
    })
    .returning();

  res.status(201).json(formatEmployee(employee));
});

router.put("/employees/:id", requireArea("employees", "edit"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const existing = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, id))
    .limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Colaborador não encontrado" });
    return;
  }

  const {
    fullName,
    email,
    phone,
    cpf,
    birthDate,
    sector,
    role,
    status,
    notes,
    userId,
  } = req.body ?? {};

  if (sector !== undefined && !isValidSector(sector)) {
    res.status(400).json({ error: "Setor inválido" });
    return;
  }
  if (role !== undefined && !isValidRole(role)) {
    res.status(400).json({ error: "Função inválida" });
    return;
  }

  const updates: Partial<typeof employeesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (fullName !== undefined) updates.fullName = String(fullName).trim();
  if (email !== undefined) updates.email = email ?? null;
  if (phone !== undefined) updates.phone = phone ?? null;
  if (cpf !== undefined) updates.cpf = cpf ?? null;
  if (birthDate !== undefined) updates.birthDate = birthDate ?? null;
  if (sector !== undefined) updates.sector = sector;
  if (role !== undefined) updates.role = role;
  if (status !== undefined) updates.status = status === "inactive" ? "inactive" : "active";
  if (notes !== undefined) updates.notes = notes ?? null;
  if (userId !== undefined) updates.userId = userId === null ? null : Number(userId);

  const [updated] = await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, id))
    .returning();

  res.json(formatEmployee(updated));
});

router.delete("/employees/:id", requireArea("employees", "edit"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const result = await db.delete(employeesTable).where(eq(employeesTable.id, id)).returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Colaborador não encontrado" });
    return;
  }
  res.json({ message: "Colaborador removido com sucesso" });
});

export default router;
// silence "unused" import for readers
void and;
