import type { Request, Response, NextFunction } from "express";
import {
  db,
  usersTable,
  hasPermission,
  hasAreaAccess,
  type PermissionKey,
  type Area,
  type Level,
} from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: Record<string, string> | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionUser?: SessionUser;
    }
  }
}

async function loadSessionUser(req: Request): Promise<SessionUser | null> {
  const sessionData = req.session as unknown as Record<string, unknown>;
  const userId = sessionData?.userId as number | undefined;
  if (!userId) return null;
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    permissions: u.permissions ?? null,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await loadSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  req.sessionUser = user;
  next();
}

export function requirePermission(key: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let user = req.sessionUser;
    if (!user) {
      const loaded = await loadSessionUser(req);
      if (!loaded) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }
      req.sessionUser = loaded;
      user = loaded;
    }
    if (!hasPermission(user, key)) {
      res.status(403).json({ error: "Acesso negado: você não possui permissão para esta ação" });
      return;
    }
    next();
  };
}

export function requireArea(area: Area, level: Level) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let user = req.sessionUser;
    if (!user) {
      const loaded = await loadSessionUser(req);
      if (!loaded) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }
      req.sessionUser = loaded;
      user = loaded;
    }
    if (!hasAreaAccess(user, area, level)) {
      res.status(403).json({ error: "Acesso negado: você não possui permissão para esta ação" });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.sessionUser;
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Apenas administradores podem executar esta ação" });
    return;
  }
  next();
}
