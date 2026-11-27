/** Rating finder helpers. Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRatingPrompt, cleanRating, ratingCacheKey } from "../server/ratings";

const sites = new Set(["amazon.com", "bestbuy.com"]);

test("cleanRating keeps a rating from a grounded site", () => {
  const r = cleanRating({ rating: 4.63, reviewCount: 1200, source: "Amazon", sourceUrl: "https://www.amazon.com/dp/B0" }, sites);
  assert.deepEqual(r, { rating: 4.6, reviewCount: 1200, source: "Amazon", sourceUrl: "https://www.amazon.com/dp/B0" });
});

test("cleanRating drops ratings from sites Google did not return", () => {
  assert.equal(cleanRating({ rating: 4.8, sourceUrl: "https://made-up.example/x" }, sites), null);
  assert.equal(cleanRating({ rating: 4.8, sourceUrl: "https://www.amazon.com/dp/B0" }, new Set()), null);
});

test("cleanRating rejects null, out-of-range, and non-numeric ratings", () => {
  for (const rating of [null, 0, 5.5, "4.5", Number.NaN]) assert.equal(cleanRating({ rating, sourceUrl: "https://amazon.com/x" }, sites), null);
  assert.equal(cleanRating(null, sites), null);
});

test("cleanRating ignores bad review counts and maps Google redirect links", () => {
  const redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";
  const r = cleanRating({ rating: 4, reviewCount: -3.5, source: "", sourceUrl: redirect }, sites, new Map([[redirect, "bestbuy.com"]]));
  assert.equal(r?.reviewCount, undefined);
  assert.equal(r?.source, "bestbuy.com");
  assert.equal(cleanRating({ rating: 4, sourceUrl: redirect }, sites), null);
});

test("prompt and cache key", () => {
  assert.match(buildRatingPrompt("Sony WH-1000XM5", "Sony"), /Never estimate or invent/);
  assert.equal(ratingCacheKey("  Sony  WH ", "SONY"), "sony wh | sony");
});
