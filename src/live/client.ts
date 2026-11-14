import type { Catalog, ClientMessage, Profile, Room, ServerMessage } from "./types";

export const API_URL: string =
  (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:8080";
export const LIVE_ENABLED = typeof process !== "undefined" && !!process.env?.NEXT_PUBLIC_API_URL;

const TOKEN_KEY = "smd.token";
type Status = "idle" | "connecting" | "online" | "offline";
type Distributive<T> = T extends { t: infer K } ? Omit<T, "t"> & { t: K } : never;
type Outgoing = Distributive<ClientMessage>;

export interface ClientEvents {
  hello?: (p: Profile, r: Room | null) => void;
  room?: (r: Room | null) => void;
  profile?: (p: Profile) => void;
  status?: (s: Status) => void;
}

export class GameError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

function storage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export async function getCatalog(): Promise<Catalog> {
  const r = await fetch(`${API_URL}/api/catalog`);
  if (!r.ok) throw new GameError("http", `catalog ${r.status}`);
  return r.json();
}

/** Returns a stored token or registers a new anonymous profile. */
export async function ensureToken(name?: string): Promise<string> {
  const s = storage();
  const saved = s?.getItem(TOKEN_KEY);
  if (saved) return saved;
  const r = await fetch(`${API_URL}/api/profile`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new GameError("http", `profile ${r.status}`);
  const { token } = await r.json();
  s?.setItem(TOKEN_KEY, token);
  return token;
}
export function clearToken() { storage()?.removeItem(TOKEN_KEY); }

export class GameClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, { ok: () => void; err: (e: GameError) => void }>();
  private retry = 0;
  private closed = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  status: Status = "idle";

  constructor(private token: string, private ev: ClientEvents = {}) {}

  private setStatus(s: Status) { this.status = s; this.ev.status?.(s); }

  connect() {
    this.closed = false;
    this.setStatus("connecting");
    const url = API_URL.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(this.token)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0; this.setStatus("online");
      this.pingTimer = setInterval(() => this.rawSend({ t: "ping" }), 20000);
    };
    ws.onmessage = (e) => {
      let m: ServerMessage;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      this.handle(m);
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      for (const [, p] of this.pending) p.err(new GameError("closed", "Connection lost"));
      this.pending.clear();
      if (this.closed) { this.setStatus("offline"); return; }
      this.setStatus("connecting");
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => { if (!this.closed) this.connect(); }, delay);
    };
    ws.onerror = () => { /* onclose handles retry */ };
  }

  close() { this.closed = true; this.ws?.close(); }

  private handle(m: ServerMessage) {
    switch (m.t) {
      case "hello": this.ev.hello?.(m.profile, m.room); break;
      case "room": this.ev.room?.(m.room); break;
      case "profile": this.ev.profile?.(m.profile); break;
      case "ok": { const p = m.id != null ? this.pending.get(m.id) : undefined; if (p) { this.pending.delete(m.id!); p.ok(); } break; }
      case "error": { const p = m.id != null ? this.pending.get(m.id) : undefined; if (p) { this.pending.delete(m.id!); p.err(new GameError(m.code, m.message)); } break; }
    }
  }

  private rawSend(msg: object) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  /** Send a command; resolves on `ok`, rejects with GameError on `error`/disconnect. */
  send(msg: Outgoing): Promise<void> {
    return new Promise((ok, err) => {
      if (this.ws?.readyState !== 1) return err(new GameError("offline", "Not connected"));
      const id = this.nextId++;
      this.pending.set(id, { ok, err });
      this.rawSend({ ...msg, id });
    });
  }
}
