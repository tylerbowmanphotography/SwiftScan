/** API-level tests with mocks (in-memory DB, mocked Resend + Stripe client). Run: npm test */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import Stripe from "stripe";

process.env.VERCEL = "1"; // don't start the listening server on import
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_PRICE_ID = "price_test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.CRON_SECRET = "cron_test_secret";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.AMAZON_ASSOCIATE_TAG = "tester-20";
process.env.FREE_SCANS_PER_DAY = "2";

const { default: app } = await import("../server");
const { MemoryStore, setStoreForTests } = await import("../server/db");
const mono = await import("../server/monetization");
const alertsMod = await import("../server/alerts");

const realStripe = new Stripe("sk_test_dummy");
const stripeCalls: { checkout: any[]; portal: any[] } = { checkout: [], portal: [] };
mono.setStripeForTests({
  webhooks: realStripe.webhooks,
  checkout: {
    sessions: {
      create: async (p: any) => (stripeCalls.checkout.push(p), { url: "https://checkout.stripe.test/c/1" }),
      retrieve: async (id: string) => ({ id, status: "complete", payment_status: "paid", client_reference_id: sessionOwner, customer: "cus_1", subscription: "sub_1" }),
    },
  },
  billingPortal: { sessions: { create: async (p: any) => (stripeCalls.portal.push(p), { url: "https://billing.stripe.test/p/1" }) } },
  customers: { retrieve: async (id: string) => ({ id, email: "lookup@example.com" }) },
});
let sessionOwner = "pat@example.com";

// ---- mocked Resend (everything else goes to the real fetch, i.e. our local server) ----
const sent: { to: string[]; subject: string; text: string }[] = [];
let resendFails = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).startsWith("https://api.resend.com/emails")) {
    if (resendFails) return new Response("boom", { status: 500 });
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  }
  return realFetch(url, init);
}) as any;

let server: http.Server;
let base = "";
before(async () => {
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => server.close());

class Client {
  jar = new Map<string, string>();
  async req(method: string, path: string, body?: any, headers: Record<string, string> = {}) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await realFetch(base + path, {
      method,
      headers: { ...(body !== undefined && typeof body !== "string" ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    for (const c of (res.headers as any).getSetCookie?.() || []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const val = pair.slice(i + 1);
      if (/Max-Age=0/i.test(c) || val === "") this.jar.delete(name);
      else this.jar.set(name, val);
    }
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text };
  }
  get = (p: string, h?: any) => this.req("GET", p, undefined, h);
  post = (p: string, b?: any, h?: any) => this.req("POST", p, b ?? {}, h);
  put = (p: string, b?: any) => this.req("PUT", p, b ?? {});
}

async function signIn(c: Client, email: string) {
  const before = sent.length;
  const r = await c.post("/api/auth/request", { email });
  assert.equal(r.status, 200, r.text);
  const code = sent[before].text.match(/code is (\d{6})/)![1];
  const v = await c.post("/api/auth/verify", { email, code });
  assert.equal(v.status, 200, v.text);
}

function webhook(c: Client, event: any, secret = "whsec_test_secret") {
  const payload = JSON.stringify(event);
  const header = realStripe.webhooks.generateTestHeaderString({ payload, secret });
  return c.req("POST", "/api/stripe-webhook", payload, { "Content-Type": "application/json", "stripe-signature": header });
}

beforeEach(() => {
  setStoreForTests(new MemoryStore());
  process.env.RESEND_API_KEY = "re_test";
  sent.length = 0;
  stripeCalls.checkout.length = 0;
  stripeCalls.portal.length = 0;
  resendFails = false;
});

// ---------------------------------------------------------------------------

test("no database: config works, accounts off, checkout works without sign-in", async () => {
  setStoreForTests(null);
  delete process.env.RESEND_API_KEY;
  const c = new Client();
  const cfg = await c.get("/api/config");
  assert.equal(cfg.status, 200);
  assert.equal(cfg.json.accounts.enabled, false);
  assert.equal(cfg.json.affiliate.amazonTag, "tester-20");
  assert.equal(cfg.json.usage.limit, 2);
  assert.equal((await c.post("/api/auth/request", { email: "a@b.co" })).status, 503);
  assert.equal((await c.put("/api/alerts", { productName: "x", targetPrice: 5 })).status, 503);
  const co = await c.post("/api/checkout");
  assert.equal(co.status, 200);
  assert.equal(co.json.url, "https://checkout.stripe.test/c/1");
  assert.equal(stripeCalls.checkout[0].client_reference_id, undefined);
  // webhook can't persist without a DB: ask Stripe to retry
  const wh = await webhook(c, { id: "evt_x", type: "customer.subscription.updated", data: { object: {} } });
  assert.equal(wh.status, 503);
});

test("sign-in: code flow, wrong code, session cookie, logout", async () => {
  const c = new Client();
  assert.equal((await c.post("/api/auth/request", { email: "not-an-email" })).status, 400);
  const r = await c.post("/api/auth/request", { email: "Pat@Example.com" });
  assert.equal(r.status, 200);
  assert.deepEqual(sent[0].to, ["pat@example.com"]);
  const code = sent[0].text.match(/code is (\d{6})/)![1];
  const wrong = await c.post("/api/auth/verify", { email: "pat@example.com", code: code === "000000" ? "111111" : "000000" });
  assert.equal(wrong.status, 401);
  assert.equal((await c.get("/api/config")).json.user, null);
  const ok = await c.post("/api/auth/verify", { email: "pat@example.com", code });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.email, "pat@example.com");
  assert.equal((await c.get("/api/config")).json.user.email, "pat@example.com");
  // code is single use
  assert.equal((await c.post("/api/auth/verify", { email: "pat@example.com", code })).status, 401);
  // tampered cookie is rejected
  const bad = new Client();
  bad.jar.set("ss_sess", c.jar.get("ss_sess")!.replace(/.$/, (x) => (x === "a" ? "b" : "a")));
  assert.equal((await bad.get("/api/config")).json.user, null);
  await c.post("/api/auth/logout");
  assert.equal((await c.get("/api/config")).json.user, null);
});

test("sign-in: attempt lockout, rate limit, email failure", async () => {
  const c = new Client();
  await c.post("/api/auth/request", { email: "lock@example.com" });
  const code = sent[0].text.match(/code is (\d{6})/)![1];
  const wrongCode = code === "123456" ? "654321" : "123456";
  for (let i = 0; i < 5; i++) assert.equal((await c.post("/api/auth/verify", { email: "lock@example.com", code: wrongCode })).status, 401);
  // right code now rejected: locked out
  assert.equal((await c.post("/api/auth/verify", { email: "lock@example.com", code })).status, 401);

  for (let i = 0; i < 4; i++) await c.post("/api/auth/request", { email: "rl@example.com" });
  const sixth = await c.post("/api/auth/request", { email: "rl@example.com" });
  assert.equal(sixth.status, 200); // 5th request overall for this email
  assert.equal((await c.post("/api/auth/request", { email: "rl@example.com" })).status, 429);

  resendFails = true;
  assert.equal((await c.post("/api/auth/request", { email: "fail@example.com" })).status, 502);
});

test("free scan quota is enforced server-side across cookie clearing, per user and device", async () => {
  const stub = express();
  stub.use(express.json());
  stub.post("/scan", mono.scanQuota, (req, res) => res.json({ success: true }));
  stub.post("/fail", mono.scanQuota, (req, res) => res.status(500).json({ success: false }));
  const srv = http.createServer(stub);
  await new Promise<void>((r) => srv.listen(0, r));
  const b = `http://127.0.0.1:${(srv.address() as any).port}`;
  const call = async (path: string, cookie = "") => {
    const r = await realFetch(b + path, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: "{}" });
    const setc = ((r.headers as any).getSetCookie?.() || []).map((c: string) => c.split(";")[0]).join("; ");
    return { status: r.status, json: await r.json(), setc };
  };
  const merge = (a: string, b2: string) => {
    const m = new Map<string, string>();
    for (const part of `${a}; ${b2}`.split("; ").filter(Boolean)) m.set(part.split("=")[0], part);
    return [...m.values()].join("; ");
  };
  let cookie = "";
  let r = await call("/scan", cookie); cookie = merge(cookie, r.setc);
  assert.equal(r.json.usage.used, 1);
  assert.equal((await call("/fail", cookie)).json.usage.used, 1); // failures don't count
  r = await call("/scan", cookie); cookie = merge(cookie, r.setc);
  assert.equal(r.json.usage.remaining, 0);
  r = await call("/scan", cookie);
  assert.equal(r.status, 429);
  assert.equal(r.json.code, "FREE_LIMIT_REACHED");
  // Clearing cookies gets a new device id but the per-IP backstop (3x limit = 6) still counts
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const x = await call("/scan", "");
    if (x.status === 429) break;
    n++;
  }
  assert.ok(n <= 4, `IP backstop should stop cookie-clearing (allowed ${n} more)`);
  srv.close();
});

test("checkout requires sign-in and is linked to the user's email; webhook sets/clears Pro; portal", async () => {
  const c = new Client();
  const anon = await c.post("/api/checkout");
  assert.equal(anon.status, 401);
  assert.equal(anon.json.code, "SIGN_IN_REQUIRED");

  await signIn(c, "pat@example.com");
  const co = await c.post("/api/checkout");
  assert.equal(co.status, 200);
  const p = stripeCalls.checkout[0];
  assert.equal(p.customer_email, "pat@example.com");
  assert.equal(p.client_reference_id, "pat@example.com");
  assert.equal(p.subscription_data.metadata.email, "pat@example.com");
  assert.equal(p.line_items[0].price, "price_test");

  assert.equal((await c.post("/api/billing-portal")).status, 404); // no subscription yet
  assert.equal((await c.get("/api/config")).json.user.isPro, false);

  // bad signature
  assert.equal((await webhook(c, { id: "evt_bad", type: "x", data: { object: {} } }, "whsec_wrong")).status, 400);

  const completed = { id: "evt_1", type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", client_reference_id: "pat@example.com", customer: "cus_1", subscription: "sub_1" } } };
  assert.equal((await webhook(c, completed)).status, 200);
  const dup = await webhook(c, completed);
  assert.equal(dup.json.duplicate, true);

  // Pro follows the account to a second device
  const phone = new Client();
  await signIn(phone, "pat@example.com");
  const cfg = await phone.get("/api/config");
  assert.equal(cfg.json.user.isPro, true);
  assert.equal(cfg.json.usage.isPro, true);
  assert.equal(cfg.json.usage.exhausted, false);
  assert.equal((await phone.post("/api/checkout")).status, 409);

  const portal = await phone.post("/api/billing-portal");
  assert.equal(portal.status, 200);
  assert.equal(stripeCalls.portal[0].customer, "cus_1");

  // payment failure: grace, still Pro
  const failed = { id: "evt_2", type: "invoice.payment_failed", data: { object: { customer: "cus_1" } } };
  assert.equal((await webhook(c, failed)).status, 200);
  assert.equal((await c.get("/api/config")).json.user.isPro, true);
  // Stripe moves subscription to unpaid/canceled: Pro cleared
  const unpaid = { id: "evt_3", type: "customer.subscription.updated", data: { object: { id: "sub_1", customer: "cus_1", status: "unpaid", metadata: {} } } };
  await webhook(c, unpaid);
  assert.equal((await c.get("/api/config")).json.user.isPro, false);
  // re-subscribe then cancel
  await webhook(c, { id: "evt_4", type: "customer.subscription.updated", data: { object: { id: "sub_2", customer: "cus_1", status: "active", current_period_end: 2000000000, metadata: { email: "pat@example.com" } } } });
  assert.equal((await c.get("/api/config")).json.user.isPro, true);
  await webhook(c, { id: "evt_5", type: "customer.subscription.deleted", data: { object: { id: "sub_2", customer: "cus_1", status: "canceled", metadata: {} } } });
  assert.equal((await c.get("/api/config")).json.user.isPro, false);
});

test("webhook resolves email from the Stripe customer when only the customer id is known", async () => {
  const c = new Client();
  await webhook(c, { id: "evt_a", type: "customer.subscription.updated", data: { object: { id: "sub_9", customer: "cus_unknown", status: "active", metadata: {} } } });
  const s = (await import("../server/db")).getStore()!;
  const rec = await s.get<any>("pro:lookup@example.com");
  assert.equal(rec.status, "active");
});

test("past_due grace expires", () => {
  const now = Date.now();
  assert.equal(mono.proRecordActive({ status: "past_due", graceUntil: now + 1000, updatedAt: now }), true);
  assert.equal(mono.proRecordActive({ status: "past_due", graceUntil: now - 1000, updatedAt: now }), false);
  assert.equal(mono.proRecordActive({ status: "canceled", updatedAt: now }), false);
  assert.equal(mono.proRecordActive(null), false);
});

test("checkout verify records Pro for the signed-in owner only", async () => {
  const c = new Client();
  assert.equal((await c.get("/api/checkout/verify?session_id=cs_test_1")).status, 401);
  await signIn(c, "pat@example.com");
  sessionOwner = "someone-else@example.com";
  assert.equal((await c.get("/api/checkout/verify?session_id=cs_test_1")).status, 403);
  sessionOwner = "pat@example.com";
  const ok = await c.get("/api/checkout/verify?session_id=cs_test_1");
  assert.equal(ok.status, 200);
  assert.equal(ok.json.usage.isPro, true);
});

test("saved items sync", async () => {
  const c = new Client();
  assert.equal((await c.get("/api/items")).status, 401);
  await signIn(c, "pat@example.com");
  const item = (id: string, name: string, ts: number) => ({ id, timestamp: ts, thumbnailUrl: "data:image/jpeg;base64,AAAA", scanResult: { productName: name }, targetPrice: 9 });
  const put = await c.put("/api/items", { items: [item("a", "Thing A", 1), item("b", "Thing B", 2), { bogus: true }] });
  assert.equal(put.json.count, 2);
  const got = await c.get("/api/items");
  assert.deepEqual(got.json.items.map((i: any) => i.id), ["b", "a"]);
  assert.equal(got.json.items[0].thumbnailUrl, undefined);
  assert.equal((await c.put("/api/items", { items: "nope" })).status, 400);
});

test("alerts: create, limits, update re-arms, remove, unsubscribe link", async () => {
  const c = new Client();
  assert.equal((await c.put("/api/alerts", { productName: "X", targetPrice: 5 })).status, 401);
  await signIn(c, "pat@example.com");
  assert.equal((await c.put("/api/alerts", { productName: "", targetPrice: 5 })).status, 400);
  assert.equal((await c.put("/api/alerts", { productName: "X", targetPrice: -1 })).status, 400);
  for (const n of ["A", "B", "C"]) assert.equal((await c.put("/api/alerts", { productName: n, targetPrice: 10 })).status, 200);
  const over = await c.put("/api/alerts", { productName: "D", targetPrice: 10 });
  assert.equal(over.status, 403);
  assert.equal(over.json.code, "ALERT_LIMIT");
  // editing an existing alert is fine at the cap
  assert.equal((await c.put("/api/alerts", { productName: "a", targetPrice: 12 })).status, 200);
  const list = await c.get("/api/alerts");
  assert.equal(list.json.alerts.length, 3);
  assert.equal(list.json.alerts.find((a: any) => a.productName.toLowerCase() === "a").targetPrice, 12);
  // pro gets a higher cap
  await webhook(c, { id: "evt_p", type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", client_reference_id: "pat@example.com", customer: "cus_1" } } });
  assert.equal((await c.put("/api/alerts", { productName: "D", targetPrice: 10 })).status, 200);

  // unsubscribe link (GET confirms, POST removes)
  const al = (await c.get("/api/alerts")).json.alerts.find((a: any) => a.productName === "D");
  const mail = alertsMod.buildAlertEmail("pat@example.com", al, { price: 8 }, "https://x.test");
  const token = mail.text.match(/unsubscribe\?t=([^\s]+)/)![1];
  const anon = new Client();
  const g = await anon.get(`/api/alerts/unsubscribe?t=${token}`);
  assert.match(g.text, /Stop this price alert/);
  assert.equal((await c.get("/api/alerts")).json.alerts.length, 4);
  const p = await anon.req("POST", "/api/alerts/unsubscribe", `t=${token}`, { "Content-Type": "application/x-www-form-urlencoded" });
  assert.match(p.text, /Alert stopped/);
  assert.equal((await c.get("/api/alerts")).json.alerts.length, 3);
  assert.equal((await anon.get("/api/alerts/unsubscribe?t=garbage")).status, 400);

  assert.equal((await c.post("/api/alerts/remove", { productName: "a" })).status, 200);
  assert.equal((await c.get("/api/alerts")).json.alerts.length, 2);
});

test("price alert cron: auth, notify once at/below target, re-arm after price rises", async () => {
  const c = new Client();
  assert.equal((await c.get("/api/cron/check-alerts")).status, 401);
  assert.equal((await c.get("/api/cron/check-alerts", { authorization: "Bearer wrong" })).status, 401);

  await signIn(c, "pat@example.com");
  await c.put("/api/alerts", { productName: "Cheap Widget", brand: "Acme", targetPrice: 20 });
  await c.put("/api/alerts", { productName: "Pricey Gadget", targetPrice: 50 });
  sent.length = 0;

  const prices: Record<string, number | null> = { "Cheap Widget": 18.5, "Pricey Gadget": 80 };
  const estimate = async (name: string) => (prices[name] == null ? null : { price: prices[name]!, retailer: "Amazon" });
  const auth = { authorization: "Bearer cron_test_secret" };

  // run through the library directly (route uses the real Gemini estimator)
  let sum = await alertsMod.runAlertCheck({ estimate, origin: "https://x.test" });
  assert.deepEqual({ ...sum }, { checked: 2, notified: 1, failed: 0, skipped: 0 });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["pat@example.com"]);
  assert.match(sent[0].subject, /Cheap Widget/);
  assert.match(sent[0].text, /estimate/i);
  assert.match(sent[0].text, /tag=tester-20/);
  assert.match(sent[0].text, /Amazon Associate/);

  // second day: still low, no duplicate email
  sum = await alertsMod.runAlertCheck({ estimate, origin: "https://x.test" });
  assert.equal(sum.notified, 0);
  assert.equal(sent.length, 1);

  // price rises above target, then falls again: notify again
  prices["Cheap Widget"] = 30;
  await alertsMod.runAlertCheck({ estimate, origin: "https://x.test" });
  prices["Cheap Widget"] = 19;
  sum = await alertsMod.runAlertCheck({ estimate, origin: "https://x.test" });
  assert.equal(sum.notified, 1);
  assert.equal(sent.length, 2);

  // failed email leaves the alert un-notified so it retries next run
  prices["Pricey Gadget"] = 40;
  resendFails = true;
  sum = await alertsMod.runAlertCheck({ estimate, origin: "https://x.test" });
  assert.equal(sum.failed, 1);
  resendFails = false;
  sum = await alertsMod.runAlertCheck({ estimate, origin: "https://x.test" });
  assert.equal(sum.notified, 1);

  // estimator returning nothing / throwing doesn't crash the run
  prices["Cheap Widget"] = null;
  const boom = async (name: string) => { if (name === "Pricey Gadget") throw new Error("ai down"); return estimate(name); };
  sum = await alertsMod.runAlertCheck({ estimate: boom, origin: "https://x.test" });
  assert.equal(sum.failed, 1);

  // limits
  sum = await alertsMod.runAlertCheck({ estimate, origin: "https://x.test", maxAlerts: 1 });
  assert.equal(sum.checked, 1);
  assert.equal(sum.skipped, 1);

  // route is authorized and reachable (no Gemini key in tests, so estimates fail but the run completes)
  const r = await c.get("/api/cron/check-alerts", auth);
  assert.equal(r.status, 200);
  assert.equal(r.json.success, true);
  assert.equal(r.json.failed, 2);
});
