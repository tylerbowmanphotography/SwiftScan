import assert from "node:assert/strict";
import test from "node:test";
import { adsenseClientId, adsenseSlotId } from "../src/utils/adsense";

test("adsense client id accepts only ca-pub- plus digits", () => {
  assert.equal(adsenseClientId(undefined), "");
  assert.equal(adsenseClientId(""), "");
  assert.equal(adsenseClientId("   "), "");
  assert.equal(adsenseClientId("  ca-pub-1234567890  "), "ca-pub-1234567890");
  assert.equal(adsenseClientId("CA-PUB-1234567890"), "");
  assert.equal(adsenseClientId("pub-1234567890"), "");
  assert.equal(adsenseClientId('ca-pub-123"></script>'), "");
  assert.equal(adsenseClientId("ca-pub-123;alert(1)"), "");
});

test("adsense slot id accepts only a numeric unit id", () => {
  assert.equal(adsenseSlotId(undefined), "");
  assert.equal(adsenseSlotId(""), "");
  assert.equal(adsenseSlotId("XXXXXXXXXX"), "");
  assert.equal(adsenseSlotId("12345"), "");
  assert.equal(adsenseSlotId(" 1234567890 "), "1234567890");
  assert.equal(adsenseSlotId("12345678901abc"), "");
});
