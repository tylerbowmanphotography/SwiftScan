import test from "node:test";
import assert from "node:assert/strict";
import { addGift, removeGift, setBudget, totals, parseGiftList, emptyList } from "../src/utils/giftList";

test("gift list totals, budget and replacing duplicates", () => {
  let l = emptyList();
  l = addGift(l, { name: "Headphones", price: 199.99, t: 1 });
  l = addGift(l, { name: "Lego Set", price: 49.5, t: 2 });
  l = addGift(l, { name: "  headphones ", price: 179, t: 3 }); // same product again replaces
  assert.equal(l.items.length, 2);
  assert.equal(totals(l).total, 228.5);
  assert.equal(totals(l).left, null); // no budget yet
  l = setBudget(l, 200);
  assert.equal(totals(l).left, -28.5);
  assert.equal(totals(l).over, true);
  l = removeGift(l, "LEGO set");
  assert.equal(totals(l).total, 179);
  assert.equal(totals(l).over, false);
});

test("gift list ignores bad input and bad saved data", () => {
  assert.equal(addGift(emptyList(), { name: "", price: 5, t: 1 }).items.length, 0);
  assert.equal(addGift(emptyList(), { name: "x", price: 0, t: 1 }).items.length, 0);
  assert.equal(setBudget(emptyList(), -5).budget, 0);
  assert.deepEqual(parseGiftList("not json"), emptyList());
  assert.deepEqual(parseGiftList(null), emptyList());
  assert.equal(parseGiftList(JSON.stringify({ budget: 100, items: [{ name: "a", price: 3, t: 1 }, { bad: 1 }] })).items.length, 1);
});
