import test from "node:test";
import assert from "node:assert/strict";
import { blackFridayDate, isBlackFridayWeek } from "../src/utils/blackFriday";

test("Black Friday dates", () => {
  assert.equal(blackFridayDate(2026).getDate(), 27);
  assert.equal(blackFridayDate(2025).getDate(), 28);
  assert.equal(blackFridayDate(2027).getDate(), 26);
});
test("banner window runs Monday of Black Friday week through Cyber Monday", () => {
  assert.equal(isBlackFridayWeek(new Date(2026, 10, 22, 12)), false);
  assert.equal(isBlackFridayWeek(new Date(2026, 10, 23, 8)), true);
  assert.equal(isBlackFridayWeek(new Date(2026, 10, 30, 22)), true);
  assert.equal(isBlackFridayWeek(new Date(2026, 11, 1, 0, 1)), false);
});

import { isPromoActive, BF_PROMO } from '../src/utils/blackFriday';
test('promo runs Nov 25 through Dec 1, 2026 only', () => {
  assert.equal(isPromoActive(new Date(2026, 10, 24, 23, 59)), false);
  assert.equal(isPromoActive(new Date(2026, 10, 25, 0, 0)), true);
  assert.equal(isPromoActive(new Date(2026, 11, 1, 23, 59)), true);
  assert.equal(isPromoActive(new Date(2026, 11, 2, 0, 0)), false);
  assert.match(BF_PROMO.url, /code=BLACKFRIDAY50$/);
});
