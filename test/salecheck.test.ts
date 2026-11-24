import test from "node:test";
import assert from "node:assert/strict";
import { checkSale } from "../src/utils/saleCheck";

const base = { msrp: 100, goodPrice: 80, greatDealPrice: 65, averagePrice: 90, highestPrice: 110 };

test("great price at or below the great-deal price", () => {
  const r = checkSale({ ...base, tagPrice: 60 });
  assert.equal(r?.verdict, "GREAT");
});
test("good price at or below fair price", () => {
  assert.equal(checkSale({ ...base, tagPrice: 78 })?.verdict, "GOOD");
});
test("about normal near the typical price", () => {
  assert.equal(checkSale({ ...base, tagPrice: 92 })?.verdict, "FAIR");
});
test("higher than usual when well above typical", () => {
  assert.equal(checkSale({ ...base, tagPrice: 130 })?.verdict, "HIGH");
});
test("inflated was price on a mediocre deal", () => {
  const r = checkSale({ ...base, tagPrice: 95, wasPrice: 200 });
  assert.equal(r?.verdict, "INFLATED");
  assert.equal(r?.claimedPct, 53);
  assert.equal(r?.wasLooksInflated, true);
});
test("inflated was price does not downgrade a genuinely good price", () => {
  const r = checkSale({ ...base, tagPrice: 70, wasPrice: 200 });
  assert.equal(r?.verdict, "GOOD");
  assert.equal(r?.wasLooksInflated, true);
  assert.match(r!.detail, /looks high/);
});
test("a sensible was price is not flagged", () => {
  assert.equal(checkSale({ ...base, tagPrice: 95, wasPrice: 110 })?.wasLooksInflated, false);
});
test("bad input returns null", () => {
  assert.equal(checkSale({ ...base, tagPrice: 0 }), null);
  assert.equal(checkSale({ ...base, tagPrice: NaN }), null);
});
