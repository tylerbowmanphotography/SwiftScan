import test from "node:test";
import assert from "node:assert/strict";
import { parseEntries, recordEntry, summarize } from "../src/utils/savings";

const e = (name: string, tag: number, typical: number) => ({ name, tag, typical, t: 1 });

test("adds up how far below typical, ignoring items at or above it", () => {
  let l = recordEntry([], e("AirPods", 80, 100));
  l = recordEntry(l, e("Toaster", 30, 25));
  l = recordEntry(l, e("Lamp", 15.5, 20));
  assert.deepEqual(summarize(l), { items: 3, below: 2, spotted: 24.5 });
});
test("checking the same product again replaces the earlier entry", () => {
  let l = recordEntry([], e("AirPods", 80, 100));
  l = recordEntry(l, e("airpods ", 70, 100));
  assert.equal(l.length, 1);
  assert.equal(l[0].tag, 70);
});
test("ignores invalid entries and caps the list", () => {
  assert.deepEqual(recordEntry([], e("", 5, 10)), []);
  assert.deepEqual(recordEntry([], e("X", 0, 10)), []);
  let l: ReturnType<typeof recordEntry> = [];
  for (let i = 0; i < 250; i++) l = recordEntry(l, e("item" + i, 1, 2));
  assert.equal(l.length, 200);
});
test("parseEntries survives bad storage", () => {
  assert.deepEqual(parseEntries(null), []);
  assert.deepEqual(parseEntries("not json"), []);
  assert.equal(parseEntries(JSON.stringify([e("A", 1, 2), { nope: true }])).length, 1);
});
