import { Router } from "express";
import { db, usersTable, getEffectivePermissions } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username e senha são obrigatórios" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  const user = users[0];

  if (!user || user.password !== password) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }

  (req.session as unknown as Record<string, unknown>).userId = user.id;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: getEffectivePermissions(user),
    },
    message: "Login realizado com sucesso",
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logout realizado com sucesso" });
  });
});

router.get("/auth/me", async (req, res) => {
  const sessionData = req.session as unknown as Record<string, unknown>;
  const userId = sessionData.userId as number | undefined;

  if (!userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const user = users[0];

  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: getEffectivePermissions(user),
  });
});

export default router;
