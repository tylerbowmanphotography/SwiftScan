/**
 * Tiny key-value layer. Uses Upstash Redis (Vercel Marketplace "Upstash for Redis") over REST when
 * KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) are set.
 * With no database configured, `getStore()` returns null and callers fall back gracefully.
 * An in-memory implementation is exported for tests.
 */
import { Redis } from "@upstash/redis";

export interface Store {
  get<T = any>(key: string): Promise<T | null>;
  /** Returns true if written (false only when `nx` and the key already existed). */
  set(key: string, value: any, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Atomically increments and (on first creation) sets a TTL. Returns the new value. */
  incr(key: string, ttlSec: number): Promise<number>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  hset(key: string, field: string, value: any): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall<T = any>(key: string): Promise<Record<string, T>>;
}

const clean = (v: string | undefined) => (v || "").trim();

export function dbCredentials(): { url: string; token: string } | null {
  const url = clean(process.env.KV_REST_API_URL) || clean(process.env.UPSTASH_REDIS_REST_URL);
  const token = clean(process.env.KV_REST_API_TOKEN) || clean(process.env.UPSTASH_REDIS_REST_TOKEN);
  return url && token ? { url, token } : null;
}

class UpstashStore implements Store {
  private r: Redis;
  constructor(url: string, token: string) {
    this.r = new Redis({ url, token, retry: { retries: 1, backoff: () => 200 } });
  }
  async get<T = any>(key: string) {
    return (await this.r.get<T>(key)) ?? null;
  }
  async set(key: string, value: any, opts?: { ex?: number; nx?: boolean }) {
    let res: any;
    if (opts?.nx && opts?.ex) res = await this.r.set(key, value, { nx: true, ex: opts.ex });
    else if (opts?.nx) res = await this.r.set(key, value, { nx: true });
    else if (opts?.ex) res = await this.r.set(key, value, { ex: opts.ex });
    else res = await this.r.set(key, value);
    return res === "OK";
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async incr(key: string, ttlSec: number) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, ttlSec);
    return n;
  }
  async sadd(key: string, member: string) {
    await this.r.sadd(key, member);
  }
  async srem(key: string, member: string) {
    await this.r.srem(key, member);
  }
  async smembers(key: string) {
    return ((await this.r.smembers(key)) as any[]).map(String);
  }
  async hset(key: string, field: string, value: any) {
    await this.r.hset(key, { [field]: value });
  }
  async hdel(key: string, field: string) {
    await this.r.hdel(key, field);
  }
  async hgetall<T = any>(key: string) {
    return ((await this.r.hgetall(key)) as Record<string, T> | null) || {};
  }
}

export class MemoryStore implements Store {
  private data = new Map<string, { v: any; exp?: number }>();
  private live(key: string) {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.exp && e.exp < Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T = any>(key: string) {
    const e = this.live(key);
    return e ? (JSON.parse(JSON.stringify(e.v)) as T) : null;
  }
  async set(key: string, value: any, opts?: { ex?: number; nx?: boolean }) {
    if (opts?.nx && this.live(key)) return false;
    this.data.set(key, { v: JSON.parse(JSON.stringify(value)), exp: opts?.ex ? Date.now() + opts.ex * 1000 : undefined });
    return true;
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async incr(key: string, ttlSec: number) {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + 1;
    this.data.set(key, { v: n, exp: e?.exp ?? Date.now() + ttlSec * 1000 });
    return n;
  }
  async sadd(key: string, member: string) {
    const e = this.live(key);
    const s: string[] = e ? e.v : [];
    if (!s.includes(member)) s.push(member);
    this.data.set(key, { v: s });
  }
  async srem(key: string, member: string) {
    const e = this.live(key);
    if (e) this.data.set(key, { v: (e.v as string[]).filter((m) => m !== member) });
  }
  async smembers(key: string) {
    const e = this.live(key);
    return e ? [...(e.v as string[])] : [];
  }
  async hset(key: string, field: string, value: any) {
    const e = this.live(key);
    const h = e ? e.v : {};
    h[field] = JSON.parse(JSON.stringify(value));
    this.data.set(key, { v: h });
  }
  async hdel(key: string, field: string) {
    const e = this.live(key);
    if (e) delete e.v[field];
  }
  async hgetall<T = any>(key: string) {
    const e = this.live(key);
    return e ? (JSON.parse(JSON.stringify(e.v)) as Record<string, T>) : {};
  }
}

let override: Store | null | undefined;
let cached: Store | null | undefined;

/** Tests inject a store (or `null` for "no database"). Pass `undefined` to restore env-based behaviour. */
export function setStoreForTests(s: Store | null | undefined) {
  override = s;
}

export function getStore(): Store | null {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;
  const c = dbCredentials();
  cached = c ? new UpstashStore(c.url, c.token) : null;
  return cached;
}

export const isDbConfigured = () => !!getStore();
