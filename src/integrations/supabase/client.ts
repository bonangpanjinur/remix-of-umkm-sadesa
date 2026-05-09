/**
 * Supabase client compatibility shim for Replit environment.
 * All database calls are proxied through the secure API server at /api/db/*.
 * Authentication is handled by our own auth system via /api/auth/*.
 * Realtime is implemented via Server-Sent Events (SSE) at /api/sse.
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
  // Reconnect SSE when session changes
  if (token) sseConnect();
  else sseDisconnect();
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

// ─── SSE Realtime Engine ──────────────────────────────────────────────────────
/**
 * Each channel subscriber registers:
 * - channelName: string
 * - type: "postgres_changes" | "broadcast"
 * - event: string (INSERT|UPDATE|DELETE|* for postgres_changes, or broadcast event name)
 * - table?: string
 * - filter?: string  (e.g. "user_id=eq.abc123")
 * - callback: (payload: any) => void
 */
interface SSESubscription {
  channelName: string;
  type: "postgres_changes" | "broadcast";
  event: string;
  table?: string;
  filter?: string;
  callback: (payload: any) => void;
}

let _sseSource: EventSource | null = null;
let _sseSubscriptions: SSESubscription[] = [];
let _sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _sseConnected = false;
let _sseBackoffMs = 3000;

/**
 * Connect to SSE endpoint. Called automatically when a user logs in.
 * Reconnects with exponential backoff on failure.
 */
function sseConnect() {
  if (!_sessionToken) return;
  if (_sseSource && _sseSource.readyState !== EventSource.CLOSED) return;

  sseDisconnect();

  const url = `${API_BASE}/sse?token=${encodeURIComponent(_sessionToken)}`;
  const source = new EventSource(url);
  _sseSource = source;

  source.onopen = () => {
    _sseConnected = true;
  };

  source.onmessage = (e) => {
    try {
      const payload = JSON.parse(e.data);
      if (payload.type === "connected") return; // handshake
      dispatchSSEEvent(payload);
    } catch {}
  };

  source.onerror = () => {
    _sseConnected = false;
    source.close();
    _sseSource = null;
    // Exponential backoff: 3s → 6s → 12s → ... → max 60s
    if (_sessionToken) {
      if (_sseReconnectTimer) clearTimeout(_sseReconnectTimer);
      _sseBackoffMs = Math.min((_sseBackoffMs || 3000) * 2, 60000);
      _sseReconnectTimer = setTimeout(sseConnect, _sseBackoffMs);
    }
  };
}

function sseDisconnect() {
  if (_sseReconnectTimer) { clearTimeout(_sseReconnectTimer); _sseReconnectTimer = null; }
  if (_sseSource) { _sseSource.close(); _sseSource = null; }
  _sseConnected = false;
  _sseBackoffMs = 3000; // reset backoff saat disconnect disengaja
}

/**
 * Route an incoming SSE event to matching subscriptions.
 *
 * For postgres_changes: match on type, table, event, and filter
 * For broadcast: match on channelName and event
 */
function dispatchSSEEvent(payload: any) {
  // Dispatch broadcast events as window custom events agar komponen bisa listen tanpa subscribe Supabase
  if (payload.type === "broadcast") {
    window.dispatchEvent(new CustomEvent("sse_broadcast", { detail: payload }));
  }

  for (const sub of _sseSubscriptions) {
    if (payload.type === "postgres_changes" && sub.type === "postgres_changes") {
      // Match table
      if (sub.table && sub.table !== payload.table) continue;
      // Match event (* = all)
      if (sub.event !== "*" && sub.event !== payload.event) continue;
      // Match filter (e.g. "user_id=eq.abc123")
      if (sub.filter && !matchFilter(sub.filter, payload.record)) continue;
      sub.callback({ eventType: payload.event, new: payload.record, old: payload.old_record || {} });
    } else if (payload.type === "broadcast" && sub.type === "broadcast") {
      if (sub.channelName !== payload.channel) continue;
      if (sub.event !== payload.event) continue;
      sub.callback(payload);
    }
  }
}

/**
 * Parse and match Supabase-style filter string against a record.
 * Supports: col=eq.val, col=neq.val, col=gt.val, col=lt.val, col=gte.val, col=lte.val
 */
function matchFilter(filter: string, record: Record<string, any>): boolean {
  if (!record) return false;
  // Support comma-separated filters: "col1=eq.val1,col2=eq.val2"
  const parts = filter.split(",");
  return parts.every((part) => {
    const m = part.trim().match(/^(\w+)=(eq|neq|gt|lt|gte|lte)\.(.+)$/);
    if (!m) return true; // unrecognised filter → pass through
    const [, col, op, val] = m;
    const recVal = record[col];
    if (op === "eq") return String(recVal) === String(val);
    if (op === "neq") return String(recVal) !== String(val);
    const numVal = Number(val);
    const numRec = Number(recVal);
    if (op === "gt") return numRec > numVal;
    if (op === "lt") return numRec < numVal;
    if (op === "gte") return numRec >= numVal;
    if (op === "lte") return numRec <= numVal;
    return true;
  });
}

// ─── Realtime Channel ─────────────────────────────────────────────────────────
/**
 * Real SSE-backed channel that replaces the Supabase Realtime channel stub.
 * Supports both postgres_changes and broadcast event types.
 */
class RealtimeChannel {
  private _name: string;
  private _subs: SSESubscription[] = [];
  private _subscribeCallback: ((status: string) => void) | null = null;
  // Required RealtimeChannel shape fields
  topic: string;
  params: Record<string, unknown> = {};
  socket: any = null;
  bindings: Record<string, unknown> = {};
  state: string = "closed";
  presence: any = null;
  broadcastEndpointURL: string = "";

  constructor(name: string) {
    this._name = name;
    this.topic = name;
  }

  on(eventType: string, filterOrCallback: any, callback?: any): this {
    if (eventType === "postgres_changes") {
      // filterOrCallback is { event, schema, table, filter }
      const filter = filterOrCallback;
      const cb = callback;
      if (!cb) return this;
      const sub: SSESubscription = {
        channelName: this._name,
        type: "postgres_changes",
        event: filter.event || "*",
        table: filter.table,
        filter: filter.filter,
        callback: cb,
      };
      this._subs.push(sub);
    } else if (eventType === "broadcast") {
      // filterOrCallback is { event: string }
      const filter = filterOrCallback;
      const cb = callback;
      if (!cb) return this;
      const sub: SSESubscription = {
        channelName: this._name,
        type: "broadcast",
        event: filter.event,
        callback: cb,
      };
      this._subs.push(sub);
    }
    return this;
  }

  subscribe(callback?: (status: string) => void): this {
    this._subscribeCallback = callback || null;
    // Register all pending subscriptions with the global SSE engine
    for (const sub of this._subs) {
      _sseSubscriptions.push(sub);
    }
    this.state = "joined";
    // Ensure SSE connection is alive
    if (_sessionToken && (!_sseSource || _sseSource.readyState === EventSource.CLOSED)) {
      sseConnect();
    }
    callback?.("SUBSCRIBED");
    return this;
  }

  async unsubscribe(): Promise<void> {
    // Remove all subscriptions registered by this channel
    _sseSubscriptions = _sseSubscriptions.filter((s) => !this._subs.includes(s));
    this._subs = [];
    this.state = "closed";
  }

  /** Broadcast a message to all subscribers on this channel (via server relay) */
  async send(msg: { type: string; event: string; payload: any }): Promise<void> {
    if (!_sessionToken) return;
    try {
      await fetch(`${API_BASE}/sse/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${_sessionToken}` },
        body: JSON.stringify({ channel: this._name, event: msg.event, payload: msg.payload }),
      });
    } catch {}
  }

  // Presence stubs (not needed but expected by TypeScript types)
  async track(_state: any) { return "ok" as const; }
  async untrack() { return "ok" as const; }
}

// ─── Query builder ────────────────────────────────────────────────────────────
class QueryBuilder {
  private _table: string;
  private _columns: string = "*";
  private _filters: Array<{ column: string; op: string; value: any }> = [];
  private _orFilters: string[] = [];
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

  select(columns: string = "*", opts?: { count?: string; head?: boolean }) {
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
  or(filterStr: string) { this._orFilters.push(filterStr); return this; }

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
            orFilters: this._orFilters,
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

  async getUser(): Promise<{ data: { user: any }; error: any }> {
    try {
      const token = _sessionToken;
      if (!token) return { data: { user: null }, error: null };
      const resp = await apiCall("/auth/me");
      const json = await resp.json();
      if (json.user) {
        _currentUser = json.user;
        const user = { id: json.user.id, email: json.user.email, user_metadata: { full_name: json.user.full_name } };
        return { data: { user }, error: null };
      }
      return { data: { user: null }, error: null };
    } catch (err) {
      return { data: { user: null }, error: err };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    _authListeners.push(callback);
    auth.getSession().then(({ data: { session } }) => {
      callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
      // Start SSE if already logged in
      if (session && _sessionToken) sseConnect();
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

  async resend(_opts: { type: string; email: string }) {
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

    async createSignedUrl(filePath: string, _expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: any }> {
      const filename = filePath.split("/").pop();
      return { data: { signedUrl: `/storage/${bucket}/${filename}` }, error: null };
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

// Active channels map for removeChannel
const _activeChannels = new Map<string, RealtimeChannel>();

// ─── S4: Exchange auth code dari URL (Replit OAuth callback) ─────────────────
/**
 * Setelah Replit OAuth, server redirect ke /?auth=success&code=xxx
 * (bukan &token= langsung). Di sini kita tukar code tersebut menjadi session token.
 * Code hanya berlaku 1 menit dan langsung dihapus setelah dipakai.
 */
async function handleAuthCodeFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const authStatus = params.get("auth");

  if (authStatus !== "success" || !code) return;

  try {
    const resp = await fetch(`${API_BASE}/auth/exchange-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await resp.json();

    if (resp.ok && json.token && json.user) {
      setSession(json.token, json.user);
      const session = {
        user: {
          id: json.user.id,
          email: json.user.email,
          user_metadata: { full_name: json.user.full_name },
        },
        access_token: json.token,
      };
      _authListeners.forEach((l) => l("SIGNED_IN", session));
    }
  } catch (err) {
    console.error("[auth] Exchange code error:", err);
  } finally {
    // Hapus ?auth=success&code=... dari URL — token tidak boleh ada di history browser
    const clean = new URL(window.location.href);
    clean.searchParams.delete("auth");
    clean.searchParams.delete("code");
    window.history.replaceState({}, "", clean.toString());
  }
}

// Auto-connect SSE if already logged in (page refresh case)
if (typeof window !== "undefined" && _sessionToken) {
  // Delay slightly to let the app initialize first
  setTimeout(sseConnect, 500);
}

// S4: Proses exchange code dari URL saat halaman dimuat
if (typeof window !== "undefined") {
  handleAuthCodeFromUrl();
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage,
  rpc,

  channel(name: string): RealtimeChannel {
    const ch = new RealtimeChannel(name);
    _activeChannels.set(name + "_" + Date.now(), ch);
    return ch;
  },

  async removeChannel(channel: RealtimeChannel): Promise<"ok"> {
    await channel.unsubscribe();
    return "ok";
  },

  realtime: { setAuth: () => {} },
};

export type {};
