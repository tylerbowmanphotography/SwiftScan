/** Coupon finder helpers. Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCoupons, domainOf, fallbackCouponLinks, groundedDomains, groundedSources, MAX_COUPONS } from "../server/coupons";

const NOW = new Date("2026-10-30T12:00:00Z");
const grounding = (sites: string[]) => ({
  candidates: [{ groundingMetadata: { groundingChunks: sites.map((s) => ({ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/x", title: s } })) } }],
});

test("domainOf: http(s) only, strips www", () => {
  assert.equal(domainOf("https://www.BestBuy.com/deal?x=1"), "bestbuy.com");
  assert.equal(domainOf("javascript:alert(1)"), null);
  assert.equal(domainOf("not a url"), null);
  assert.equal(domainOf(42), null);
});

test("groundedDomains reads chunk titles and ignores Google redirect hosts", () => {
  const d = groundedDomains(grounding(["bestbuy.com", "www.slickdeals.net"]));
  assert.deepEqual([...d].sort(), ["bestbuy.com", "slickdeals.net"]);
  assert.equal(groundedDomains({}).size, 0);
});

test("cleanCoupons keeps only coupons from sites Google Search returned", () => {
  const allowed = groundedDomains(grounding(["bestbuy.com"]));
  const out = cleanCoupons(
    {
      coupons: [
        { store: "Best Buy", title: "$20 off", kind: "deal", sourceUrl: "https://www.bestbuy.com/site/x" },
        { store: "Made Up", title: "50% off", kind: "code", code: "FAKE50", sourceUrl: "https://invented-coupons.example/x" },
      ],
    },
    allowed,
    NOW,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].store, "Best Buy");
  assert.equal(out[0].sourceDomain, "bestbuy.com");
});

test("cleanCoupons drops expired, unsourced, duplicate and junk entries; normalizes codes", () => {
  const out = cleanCoupons(
    {
      coupons: [
        { store: "Target", title: "15% off", code: "save15", sourceUrl: "https://target.com/p" },
        { store: "Target", title: "15% off again", code: "SAVE15", sourceUrl: "https://target.com/p2" },
        { store: "Walmart", title: "Old deal", expires: "2026-01-01", sourceUrl: "https://walmart.com/x" },
        { store: "Amazon", title: "No link" },
        { store: "Amazon", title: "Bad link", sourceUrl: "ftp://amazon.com/x" },
        { store: "Brand", title: "$10 rebate", kind: "rebate", code: "has spaces!", expires: "2026-12-31", sourceUrl: "https://brand.com/rebate" },
        "garbage",
      ],
    },
    new Set(),
    NOW,
  );
  assert.deepEqual(
    out.map((c) => [c.store, c.code, c.kind, c.expires]),
    [
      ["Target", "SAVE15", "code", undefined],
      ["Brand", undefined, "rebate", "2026-12-31"],
    ],
  );
});

test("cleanCoupons caps the list length", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ store: `S${i}`, title: `Deal ${i}`, sourceUrl: `https://s${i}.com/` }));
  assert.equal(cleanCoupons({ coupons: many }, new Set(), NOW).length, MAX_COUPONS);
});

test("fallbackCouponLinks: brand link only when the brand is known", () => {
  assert.equal(fallbackCouponLinks("AirPods Pro", "Apple").length, 3);
  assert.equal(fallbackCouponLinks("Mystery item", "Unknown brand").length, 2);
  assert.ok(fallbackCouponLinks("A&B", "X")[0].url.includes(encodeURIComponent("A&B")));
});

test("cleanCoupons accepts Google grounding redirect links and maps them to the real site", () => {
  const R = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";
  const g = groundedSources({
    candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: R + "abc", title: "target.com" } }] } }],
  });
  const out = cleanCoupons(
    {
      coupons: [
        { store: "Target", title: "$3 off with Circle", sourceUrl: R + "abc" },
        { store: "Nowhere", title: "Unmapped redirect", sourceUrl: R + "zzz" },
      ],
    },
    g.domains,
    NOW,
    g.redirects,
  );
  assert.deepEqual(out.map((c) => [c.store, c.sourceDomain, c.sourceUrl]), [["Target", "target.com", R + "abc"]]);
});
