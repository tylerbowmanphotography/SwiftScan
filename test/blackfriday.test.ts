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
