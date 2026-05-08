/**
 * Supabase client compatibility shim for Replit environment.
 * All database calls are proxied through the secure API server at /api/db/*.
 * Authentication is handled by our own auth system via /api/auth/*.
 */

const API_BASE = "/api";

// ─── Session management ───────────────────────────────────────────────────────
let _sessionToken: string | null = null;
let _currentUser: any | null = null;
let _authListeners: Array<(event: string, session: any) => void> = [];

try { _sessionToken = localStorage.getItem("session_token"); } catch {}

function setSession(token: string | null, user: any | null) {
  _sessionToken = token;
  _currentUser = user;
  try {
    if (token) localStorage.setItem("session_token", token);
    else localStorage.removeItem("session_token");
  } catch {}
}

function getAuthHeaders(): Record<string, string> {
  if (_sessionToken) return { Authorization: `Bearer ${_sessionToken}` };
  return {};
}

async function apiCall(path: string, options: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  });
}

// ─── Query builder ────────────────────────────────────────────────────────────
class QueryBuilder {
  private _table: string;
  private _columns: string = "*";
  private _filters: Array<{ column: string; op: string; value: any }> = [];
  private _order: { column: string; ascending: boolean } | null = null;
  private _limit: number | null = null;
  private _offset: number | null = null;
  private _count: string | null = null;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _operation: "select" | "insert" | "update" | "delete" = "select";
  private _data: any = null;
  private _upsert: boolean = false;
  private _onConflict: string | null = null;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = "*", opts?: { count?: string }) {
    this._columns = columns;
    if (opts?.count) this._count = opts.count;
    this._operation = "select";
    return this;
  }

  insert(data: any, opts?: { upsert?: boolean; onConflict?: string }) {
    this._operation = "insert";
    this._data = data;
    this._upsert = opts?.upsert || false;
    this._onConflict = opts?.onConflict || null;
    return this;
  }

  upsert(data: any, opts?: { onConflict?: string }) {
    this._operation = "insert";
    this._data = data;
    this._upsert = true;
    this._onConflict = opts?.onConflict || null;
    return this;
  }

  update(data: any) { this._operation = "update"; this._data = data; return this; }
  delete() { this._operation = "delete"; return this; }

  eq(column: string, value: any) { this._filters.push({ column, op: "=", value }); return this; }
  neq(column: string, value: any) { this._filters.push({ column, op: "neq", value }); return this; }
  gt(column: string, value: any) { this._filters.push({ column, op: "gt", value }); return this; }
  gte(column: string, value: any) { this._filters.push({ column, op: "gte", value }); return this; }
  lt(column: string, value: any) { this._filters.push({ column, op: "lt", value }); return this; }
  lte(column: string, value: any) { this._filters.push({ column, op: "lte", value }); return this; }
  like(column: string, value: any) { this._filters.push({ column, op: "ilike", value }); return this; }
  ilike(column: string, value: any) { this._filters.push({ column, op: "ilike", value }); return this; }
  in(column: string, values: any[]) { this._filters.push({ column, op: "in", value: values }); return this; }
  is(column: string, value: any) { this._filters.push({ column, op: "is", value }); return this; }
  not(column: string, op: string, value: any) {
    if (op === "is") this._filters.push({ column, op: "is_not", value });
    else this._filters.push({ column, op: "neq", value });
    return this;
  }
  contains(column: string, value: any) { this._filters.push({ column, op: "contains", value }); return this; }
  overlaps(column: string, value: any) { this._filters.push({ column, op: "overlaps", value }); return this; }
  textSearch(column: string, value: string) { this._filters.push({ column, op: "fts", value }); return this; }
  filter(column: string, op: string, value: any) { this._filters.push({ column, op, value }); return this; }
  match(obj: Record<string, any>) { Object.entries(obj).forEach(([k,v]) => this._filters.push({ column: k, op: "=", value: v })); return this; }

  order(column: string, opts?: { ascending?: boolean }) {
    this._order = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) { this._limit = n; return this; }
  range(from: number, to: number) { this._offset = from; this._limit = to - from + 1; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  then(resolve: (value: any) => any, reject?: (reason: any) => any): Promise<any> {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<{ data: any; error: any; count?: number | null }> {
    try {
      let resp: Response;

      if (this._operation === "select") {
        resp = await apiCall("/db/select", {
          method: "POST",
          body: JSON.stringify({
            table: this._table,
            columns: this._columns,
            filters: this._filters,
            order: this._order,
            limit: this._limit,
            offset: this._offset,
            count: this._count,
            single: this._single,
            maybeSingle: this._maybeSingle,
          }),
        });
      } else if (this._operation === "insert") {
        resp = await apiCall("/db/insert", {
          method: "POST",
          body: JSON.stringify({
            table: this._table,
            rows: this._data,
            upsert: this._upsert,
            onConflict: this._onConflict,
          }),
        });
      } else if (this._operation === "update") {
        resp = await apiCall("/db/update", {
          method: "POST",
          body: JSON.stringify({
            table: this._table,
            updates: this._data,
            filters: this._filters,
          }),
        });
      } else if (this._operation === "delete") {
        resp = await apiCall("/db/delete", {
          method: "POST",
          body: JSON.stringify({
            table: this._table,
            filters: this._filters,
          }),
        });
      } else {
        return { data: null, error: new Error("Unknown operation") };
      }

      const json = await resp.json();
      if (!resp.ok) {
        return { data: null, error: new Error(json.error || "Request failed"), count: json.count ?? null };
      }
      return { data: json.data, error: null, count: json.count ?? null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
}

// ─── Auth shim ────────────────────────────────────────────────────────────────
const auth = {
  async getSession(): Promise<{ data: { session: any }; error: any }> {
    try {
      const token = _sessionToken;
      if (!token) return { data: { session: null }, error: null };
      const resp = await apiCall("/auth/me");
      const json = await resp.json();
      if (json.user) {
        _currentUser = json.user;
        const session = {
          user: { id: json.user.id, email: json.user.email, user_metadata: { full_name: json.user.full_name } },
          access_token: token,
        };
        return { data: { session }, error: null };
      }
      return { data: { session: null }, error: null };
    } catch (err) {
      return { data: { session: null }, error: err };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    _authListeners.push(callback);
    auth.getSession().then(({ data: { session } }) => {
      callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            _authListeners = _authListeners.filter((l) => l !== callback);
          },
        },
      },
    };
  },

  async signUp(opts: { email: string; password: string; options?: { emailRedirectTo?: string; data?: any } }) {
    try {
      const resp = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: opts.email, password: opts.password, full_name: opts.options?.data?.full_name || "" }),
      });
      const json = await resp.json();
      if (!resp.ok) return { data: null, error: new Error(json.error || "Registration failed") };
      setSession(json.token, json.user);
      const session = { user: { id: json.user.id, email: json.user.email, user_metadata: { full_name: json.user.full_name } }, access_token: json.token };
      _authListeners.forEach((l) => l("SIGNED_IN", session));
      return { data: { user: session.user, session }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async signInWithPassword(opts: { email: string; password: string }) {
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: opts.email, password: opts.password }),
      });
      const json = await resp.json();
      if (!resp.ok) return { data: null, error: new Error(json.error || "Login failed") };
      setSession(json.token, json.user);
      const session = { user: { id: json.user.id, email: json.user.email, user_metadata: { full_name: json.user.full_name } }, access_token: json.token };
      _authListeners.forEach((l) => l("SIGNED_IN", session));
      return { data: { user: session.user, session }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async signOut() {
    try { await apiCall("/auth/logout", { method: "POST" }); } catch {}
    setSession(null, null);
    _authListeners.forEach((l) => l("SIGNED_OUT", null));
    return { error: null };
  },

  async updateUser(updates: { password?: string; data?: any }) {
    try {
      if (updates.password) {
        const resp = await apiCall("/auth/update-password", { method: "POST", body: JSON.stringify({ new_password: updates.password }) });
        const json = await resp.json();
        if (!resp.ok) return { data: null, error: new Error(json.error) };
      }
      return { data: { user: _currentUser }, error: null };
    } catch (err) { return { data: null, error: err }; }
  },

  async resetPasswordForEmail(_email: string, _opts?: any) {
    return { error: null };
  },

  async exchangeCodeForSession(_code: string) {
    return { data: null, error: null };
  },

  async signInWithOAuth(_opts: any) {
    return { data: null, error: new Error("OAuth not supported. Please use email/password.") };
  },
};

// ─── Storage shim ─────────────────────────────────────────────────────────────
function storageFrom(bucket: string) {
  return {
    async upload(filePath: string, file: File, _opts?: any): Promise<{ data: any; error: any }> {
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const resp = await apiCall("/storage/upload", { method: "POST", body: JSON.stringify({ bucket, path: filePath, data: base64, contentType: file.type }) });
        const json = await resp.json();
        if (!resp.ok) return { data: null, error: new Error(json.error) };
        return { data: { path: filePath, fullPath: json.url }, error: null };
      } catch (err) { return { data: null, error: err }; }
    },

    getPublicUrl(filePath: string) {
      const filename = filePath.split("/").pop();
      return { data: { publicUrl: `/storage/${bucket}/${filename}` } };
    },

    async remove(_paths: string[]): Promise<{ data: any; error: any }> {
      return { data: {}, error: null };
    },

    async list(_prefix?: string): Promise<{ data: any; error: any }> {
      return { data: [], error: null };
    },
  };
}

const storage = { from: storageFrom };

// ─── RPC shim ─────────────────────────────────────────────────────────────────
async function rpc(fn: string, args?: any): Promise<{ data: any; error: any }> {
  try {
    const resp = await apiCall(`/db/rpc/${fn}`, { method: "POST", body: JSON.stringify(args || {}) });
    const json = await resp.json();
    if (!resp.ok) return { data: null, error: new Error(json.error) };
    return { data: json.data, error: null };
  } catch (err) { return { data: null, error: err }; }
}

// ─── Main supabase client ─────────────────────────────────────────────────────
export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage,
  rpc,
  channel: (_name: string) => ({
    on: (_event: string, _filter: any, _callback: any) => ({ subscribe: (_cb?: any) => ({ unsubscribe: () => {} }) }),
    subscribe: (_cb?: any) => ({ unsubscribe: () => {} }),
  }),
  removeChannel: (_channel: any) => Promise.resolve(),
  realtime: { setAuth: () => {} },
};

export type {};
