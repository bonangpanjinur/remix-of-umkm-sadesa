import { Router, Request, Response } from "express";
import { pool } from "../db";
import {
  hashPasswordWithSalt,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  getUserById,
  createOrUpdateReplitUser,
} from "../auth";

const router = Router();

// Register new user
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "Email, password, and full_name are required" });
  }

  // S10: Validasi kekuatan password minimum
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password minimal 8 karakter" });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: "Password harus mengandung huruf dan angka" });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT id FROM public.users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = hashPasswordWithSalt(password);
    const userRes = await client.query(
      `INSERT INTO public.users (email, full_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [email.toLowerCase().trim(), full_name, passwordHash]
    );
    const user = userRes.rows[0];

    await client.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'buyer')
       ON CONFLICT (user_id, role) DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO public.profiles (user_id, full_name)
       VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [user.id, full_name]
    );

    const token = createSession(user.id);

    return res.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, roles: ["buyer"] },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed" });
  } finally {
    client.release();
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const client = await pool.connect();
  try {
    const userRes = await client.query(
      "SELECT id, email, full_name, password_hash FROM public.users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    const user = userRes.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    const rolesRes = await client.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1",
      [user.id]
    );
    const roles = rolesRes.rows.map((r: any) => r.role);
    const token = createSession(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles: roles.length > 0 ? roles : ["buyer"],
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  } finally {
    client.release();
  }
});

// Get current user
router.get("/me", async (req: Request, res: Response) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    (req as any).cookies?.session_token;

  if (!token) {
    return res.json({ user: null });
  }

  const userId = getSessionUser(token);
  if (!userId) {
    return res.json({ user: null });
  }

  const user = await getUserById(userId);
  if (!user) {
    return res.json({ user: null });
  }

  return res.json({ user });
});

// Logout
router.post("/logout", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) deleteSession(token);
  return res.json({ success: true });
});

// Replit OAuth callback (for Replit Auth)
router.get("/replit/callback", async (req: Request, res: Response) => {
  try {
    const replitUserId = req.headers["x-replit-user-id"] as string;
    const replitUserName = req.headers["x-replit-user-name"] as string;

    if (!replitUserId) {
      return res.redirect("/?auth=failed");
    }

    const user = await createOrUpdateReplitUser({
      id: replitUserId,
      name: replitUserName,
    });

    const token = createSession(user.id);
    return res.redirect(`/?auth=success&token=${token}`);
  } catch (err) {
    console.error("Replit callback error:", err);
    return res.redirect("/?auth=failed");
  }
});

// Update password
router.post("/update-password", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const userId = getSessionUser(token);
  if (!userId) return res.status(401).json({ error: "Session expired" });

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "current_password and new_password required" });
  }

  // S10: Validasi password baru
  if (typeof new_password !== "string" || new_password.length < 8) {
    return res.status(400).json({ error: "Password baru minimal 8 karakter" });
  }
  if (!/[A-Za-z]/.test(new_password) || !/[0-9]/.test(new_password)) {
    return res.status(400).json({ error: "Password baru harus mengandung huruf dan angka" });
  }

  const client = await pool.connect();
  try {
    const userRes = await client.query(
      "SELECT password_hash FROM public.users WHERE id = $1",
      [userId]
    );
    const user = userRes.rows[0];
    if (!user?.password_hash || !verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: "Password lama tidak sesuai" });
    }

    const newHash = hashPasswordWithSalt(new_password);
    await client.query(
      "UPDATE public.users SET password_hash = $1, updated_at = now() WHERE id = $2",
      [newHash, userId]
    );

    return res.json({ success: true });
  } finally {
    client.release();
  }
});

export default router;
