import test from "node:test";
import assert from "node:assert/strict";
import { buyTiming } from "../src/utils/buyTiming";

test("buy timing: needs history first", () => {
  assert.equal(buyTiming({ good: 0, checks: 9, low: 1, high: 2 }), null);
  assert.equal(buyTiming({ good: 100, checks: 1 })!.verdict, "EARLY");
  assert.equal(buyTiming({ good: 100, checks: 3, low: 90, high: 120 })!.verdict, "EARLY");
  assert.match(buyTiming({ good: 100, checks: 1 })!.detail, /1 time so far/);
});

test("buy timing: position inside the recorded range", () => {
  const base = { checks: 8, low: 80, high: 120 };
  assert.equal(buyTiming({ ...base, good: 82 })!.verdict, "BUY");
  assert.equal(buyTiming({ ...base, good: 100 })!.verdict, "MID");
  assert.equal(buyTiming({ ...base, good: 118 })!.verdict, "WAIT");
  assert.equal(buyTiming({ good: 100, checks: 8, low: 99, high: 101 })!.verdict, "STABLE");
});
