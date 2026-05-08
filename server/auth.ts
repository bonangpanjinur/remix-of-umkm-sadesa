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

// ─── Password hashing ─────────────────────────────────────────────────────────

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

// ─── DB initialisation ────────────────────────────────────────────────────────

/**
 * S8: Buat tabel sessions dan auth_codes jika belum ada.
 * Dipanggil sekali saat server start.
 */
export async function initSessionsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sessions (
        token       TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx   ON public.sessions (user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_idx   ON public.sessions (expires_at);

      CREATE TABLE IF NOT EXISTS public.auth_codes (
        code        TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * S8: Hapus session yang sudah expired secara periodik.
 * Dipanggil sekali saat start, lalu setiap 1 jam.
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "DELETE FROM public.sessions WHERE expires_at < now() RETURNING token"
    );
    await client.query("DELETE FROM public.auth_codes WHERE expires_at < now()");
    if (r.rowCount && r.rowCount > 0) {
      console.log(`[sessions] Cleanup: ${r.rowCount} expired session(s) dihapus`);
    }
  } catch (err) {
    console.error("[sessions] Cleanup error:", err);
  } finally {
    client.release();
  }
}

// ─── Session management (DB-backed, S8) ──────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

/** Buat session baru di DB dan kembalikan token */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO public.sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
      [token, userId, expiresAt]
    );
  } finally {
    client.release();
  }
  return token;
}

/** Ambil user_id dari token yang valid; null jika tidak ada / expired */
export async function getSessionUser(token: string): Promise<string | null> {
  if (!token) return null;
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT user_id FROM public.sessions WHERE token = $1 AND expires_at > now()",
      [token]
    );
    return res.rows[0]?.user_id ?? null;
  } finally {
    client.release();
  }
}

/** Hapus session dari DB (logout) */
export async function deleteSession(token: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM public.sessions WHERE token = $1", [token]);
  } finally {
    client.release();
  }
}

// ─── Auth code (S4: token di URL → exchange via short-lived code) ─────────────

const AUTH_CODE_TTL_MS = 60 * 1000; // 1 menit

/** Buat one-time auth code yang bisa ditukar menjadi session token */
export async function createAuthCode(userId: string): Promise<string> {
  const code = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO public.auth_codes (code, user_id, expires_at) VALUES ($1, $2, $3)",
      [code, userId, expiresAt]
    );
  } finally {
    client.release();
  }
  return code;
}

/**
 * Tukar auth code menjadi session token (hapus code setelah berhasil).
 * Kembalikan token session, atau null jika code tidak valid / expired.
 */
export async function exchangeAuthCode(code: string): Promise<string | null> {
  if (!code) return null;
  const client = await pool.connect();
  try {
    const res = await client.query(
      "DELETE FROM public.auth_codes WHERE code = $1 AND expires_at > now() RETURNING user_id",
      [code]
    );
    const userId = res.rows[0]?.user_id;
    if (!userId) return null;
    return await createSession(userId);
  } finally {
    client.release();
  }
}

// ─── User lookups ─────────────────────────────────────────────────────────────

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

// ─── Rate limiting (S7) ───────────────────────────────────────────────────────

interface RateLimitEntry { count: number; resetAt: number }
const _rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_WINDOW_MS   = 15 * 60 * 1000; // 15 menit
const RATE_MAX_HITS    = 10;              // maks 10 percobaan per window

/**
 * Cek apakah IP masih dalam batas rate limit.
 * Kembalikan true (diizinkan) atau false (diblokir).
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    _rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_MAX_HITS) return false;

  entry.count++;
  return true;
}

/** Reset hit counter untuk IP tertentu setelah login berhasil */
export function resetRateLimit(ip: string): void {
  _rateLimitMap.delete(ip);
}

// Bersihkan entri rate limit yang sudah expired setiap 30 menit
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _rateLimitMap) {
    if (now > entry.resetAt) _rateLimitMap.delete(ip);
  }
}, 30 * 60 * 1000);

// ─── Auth middleware ───────────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    (req as any).cookies?.session_token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = await getSessionUser(token);
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
