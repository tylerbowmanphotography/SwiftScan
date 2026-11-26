import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore plain JS module
import { STORES, storePage, sitemap, robots } from "../scripts/gen-seo.mjs";
import { DEAL_STORES, dealStore } from "../server/coupons";

test("every SEO store is one the deals API accepts, and vice versa", () => {
  assert.deepEqual(STORES.map((s: any) => s.name).sort(), [...DEAL_STORES].sort());
  for (const s of STORES) assert.equal(dealStore(s.name), s.name);
});

test("store pages have a unique title, canonical URL and valid inline script", () => {
  const titles = new Set<string>();
  for (const s of STORES) {
    const html: string = storePage(s);
    const title = /<title>(.*?)<\/title>/.exec(html)![1];
    assert.ok(!titles.has(title));
    titles.add(title);
    assert.ok(html.includes(`rel="canonical" href="https://www.swiftscan.store/deals/${s.slug}"`));
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
    assert.doesNotThrow(() => new Function(script)); // parses (not run)
  }
});

test("sitemap lists every store page; robots blocks only the API and points at the sitemap", () => {
  const map: string = sitemap();
  for (const s of STORES) assert.ok(map.includes(`/deals/${s.slug}<`));
  assert.ok(robots.includes("Disallow: /api/") && robots.includes("Sitemap: https://www.swiftscan.store/sitemap.xml"));
});
