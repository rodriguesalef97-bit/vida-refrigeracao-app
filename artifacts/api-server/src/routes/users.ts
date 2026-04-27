import { Router } from "express";
import {
  db,
  usersTable,
  employeesTable,
  getDefaultPermissionsForRole,
  getEffectivePermissions,
  normalizePermissions,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireArea } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

type UserRow = typeof usersTable.$inferSelect;

function formatUser(u: UserRow, employee?: { id: number; sector: string; role: string } | null) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    permissions: getEffectivePermissions(u),
    customPermissions: (u.permissions ?? null) as Record<string, string> | null,
    defaultPermissions: getDefaultPermissionsForRole(u.role),
    employee: employee ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", requireArea("users", "view"), async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const employees = await db.select().from(employeesTable);
  const empByUserId = new Map<number, typeof employees[number]>();
  for (const e of employees) {
    if (e.userId) empByUserId.set(e.userId, e);
  }
  res.json(
    users.map((u) => {
      const e = empByUserId.get(u.id);
      return formatUser(u, e ? { id: e.id, sector: e.sector, role: e.role } : null);
    }),
  );
});

router.get("/users/:id", requireArea("users", "view"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  const u = rows[0];
  if (!u) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const empRows = await db.select().from(employeesTable).where(eq(employeesTable.userId, id)).limit(1);
  const e = empRows[0];
  res.json(formatUser(u, e ? { id: e.id, sector: e.sector, role: e.role } : null));
});

router.put("/users/:id/permissions", requireArea("permissions", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  if (req.sessionUser && req.sessionUser.id === id) {
    res.status(403).json({ error: "Você não pode alterar suas próprias permissões" });
    return;
  }
  const { permissions } = req.body ?? {};

  let normalized: Record<string, string> | null;
  if (permissions === null || permissions === undefined) {
    normalized = null;
  } else if (typeof permissions === "object") {
    normalized = normalizePermissions(permissions);
  } else {
    res.status(400).json({ error: "Permissões inválidas" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ permissions: normalized })
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const empRows = await db.select().from(employeesTable).where(eq(employeesTable.userId, id)).limit(1);
  const e = empRows[0];
  res.json(formatUser(updated, e ? { id: e.id, sector: e.sector, role: e.role } : null));
});

router.put("/users/:id/role", requireArea("users", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  if (req.sessionUser && req.sessionUser.id === id) {
    res.status(403).json({ error: "Você não pode alterar seu próprio perfil" });
    return;
  }
  const { role } = req.body ?? {};
  const allowed = ["admin", "technician", "commercial", "financial"];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: "Perfil inválido" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ role, permissions: null })
    .where(eq(usersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(formatUser(updated));
});

export default router;
