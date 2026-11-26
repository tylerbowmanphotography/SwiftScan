import test from "node:test";
import assert from "node:assert/strict";
import { addPurchase, removePurchase, daysLeft, recheckBy, parsePurchases, icsReminder } from "../src/utils/purchases";

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date(2026, 10, 27, 12).getTime();

test("purchases: window math, replace duplicates, ignore bad input", () => {
  let l = addPurchase([], { name: "TV", price: 400, boughtAt: t0, windowDays: 30 });
  l = addPurchase(l, { name: " tv ", price: 380, boughtAt: t0, windowDays: 14 });
  assert.equal(l.length, 1);
  assert.equal(l[0].price, 380);
  assert.equal(daysLeft(l[0], t0), 14);
  assert.equal(daysLeft(l[0], t0 + 14 * DAY), 0);
  assert.ok(daysLeft(l[0], t0 + 20 * DAY) < 0);
  assert.equal(recheckBy(l[0]), t0 + 14 * DAY);
  assert.equal(addPurchase([], { name: "", price: 5, boughtAt: 1, windowDays: 14 }).length, 0);
  assert.equal(addPurchase([], { name: "x", price: 0, boughtAt: 1, windowDays: 14 }).length, 0);
  assert.equal(removePurchase(l, "TV").length, 0);
  assert.deepEqual(parsePurchases("nope"), []);
});

test("purchases: .ics reminder is valid and escapes text", () => {
  const ics = icsReminder({ name: "Mixer, red; 5qt", price: 99.5, boughtAt: t0, windowDays: 30 }, t0);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261225\r\n/); // Nov 27 + 30 days = Dec 27, minus 2 days
  assert.match(ics, /SUMMARY:Re-check the price of Mixer\\, red\; 5qt/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
