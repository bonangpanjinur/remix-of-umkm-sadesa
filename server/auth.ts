import { Request, Response, NextFunction } from "express";
import { pool } from "./db";
import * as crypto from "crypto";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  replit_id?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: { userId?: string };
    }
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPasswordWithSalt(password: string): string {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const client = await pool.connect();
  try {
    const userRes = await client.query(
      "SELECT id, email, full_name, replit_id FROM public.users WHERE id = $1",
      [userId]
    );
    if (!userRes.rows[0]) return null;
    const user = userRes.rows[0];

    const rolesRes = await client.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1",
      [userId]
    );
    const roles = rolesRes.rows.map((r: any) => r.role);

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      replit_id: user.replit_id,
      roles: roles.length > 0 ? roles : ["buyer"],
    };
  } finally {
    client.release();
  }
}

export async function getUserByReplitId(replitId: string): Promise<AuthUser | null> {
  const client = await pool.connect();
  try {
    const userRes = await client.query(
      "SELECT id, email, full_name, replit_id FROM public.users WHERE replit_id = $1",
      [replitId]
    );
    if (!userRes.rows[0]) return null;
    const user = userRes.rows[0];
    const rolesRes = await client.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1",
      [user.id]
    );
    const roles = rolesRes.rows.map((r: any) => r.role);
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      replit_id: user.replit_id,
      roles: roles.length > 0 ? roles : ["buyer"],
    };
  } finally {
    client.release();
  }
}

export async function createOrUpdateReplitUser(replitUser: {
  id: string;
  email?: string;
  name?: string;
}): Promise<AuthUser> {
  const client = await pool.connect();
  try {
    const email = replitUser.email || `replit_${replitUser.id}@replit.local`;
    const fullName = replitUser.name || "Pengguna";

    const res = await client.query(
      `INSERT INTO public.users (email, full_name, replit_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (replit_id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             updated_at = now()
       RETURNING id, email, full_name, replit_id`,
      [email, fullName, replitUser.id]
    );
    const user = res.rows[0];

    await client.query(
      `INSERT INTO public.user_roles (user_id, role)
       VALUES ($1, 'buyer')
       ON CONFLICT (user_id, role) DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO public.profiles (user_id, full_name)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, fullName]
    );

    const rolesRes = await client.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1",
      [user.id]
    );
    const roles = rolesRes.rows.map((r: any) => r.role);

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      replit_id: user.replit_id,
      roles: roles.length > 0 ? roles : ["buyer"],
    };
  } finally {
    client.release();
  }
}

// Sessions stored in DB
const sessions = new Map<string, { userId: string; expiresAt: number }>();

export function createSession(userId: string): string {
  const token = generateToken();
  sessions.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return token;
}

export function getSessionUser(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    (req as any).cookies?.session_token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = getSessionUser(token);
  if (!userId) {
    return res.status(401).json({ error: "Session expired" });
  }

  const user = await getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = user;
  next();
}

export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, async () => {
      if (!req.user?.roles.includes(role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    });
  };
}
