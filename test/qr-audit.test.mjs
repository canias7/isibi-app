// QR CODES, TWO AUDIT FINDINGS (2026-10-23, r1-g3): A31-5 (a designed code
// that can never be drawn was stored) and A31-7 (a wifi code whose fields
// carry an unescaped `;` was accepted, and cannot join).
import test from "node:test";
import assert from "node:assert/strict";
import { mergeLook, keepsValue } from "../builder/site-edit.mjs";
import { readQrText, patchQr } from "../builder/site-qr-list.mjs";

const PAY = { name: "pay", points: "upi://pay?pa=bakery@okaxis", label: "Pay by UPI" };
const WIFI = { name: "wifi", points: "WIFI:T:WPA;S:Bakery Guest;P:sourdough;;", label: "Free wifi" };

test("A31-5: a designed code the publish cannot draw is not stored; the drawable one beside it is", () => {
  const first = mergeLook(null, { qr: [PAY, WIFI] }, {});
  assert.deepEqual(first.qr.map((c) => c.name), ["wifi"], JSON.stringify(first.qr));
  // A design whose only code is undrawable does not replace a good stored list.
  const kept = mergeLook({ qr: [WIFI] }, { qr: [PAY] }, {}, { instructed: true });
  assert.deepEqual(kept.qr, [WIFI]);
  assert.equal(keepsValue("qr", [PAY]), false);
  assert.equal(keepsValue("qr", [WIFI]), true);
  // A STORED list is left as it was, so an unrelated edit moves nothing.
  const stored = [PAY, WIFI];
  assert.equal(mergeLook({ qr: stored }, { description: "x" }, {}, { instructed: true }).qr, stored);
});

test("A31-7: a wifi code is checked field by field; an escaped one is accepted", () => {
  assert.ok(readQrText(WIFI.points).text);
  assert.ok(readQrText("WIFI:T:WPA;S:Bakery\\: Guest;P:sour\\;dough;;").text, "escaped fields are fine");
  assert.ok(readQrText("WIFI:S:Bakery;T:WPA;P:x;H:false;;").text, "any order, hidden flag");
  assert.ok(readQrText("WIFI:T:nopass;S:Open Bakery;;").text);
  for (const bad of ["WIFI:T:WPA;S:Bakery;P:sour;dough;;", "WIFI:T:WPA;P:abc;;", "WIFI:T:WPA;S:a;P:b\\"]) {
    const r = readQrText(bad);
    assert.equal(r.text, null, bad);
    assert.match(r.why, /wifi/i, bad);
  }
  // The qr lane's patch goes through the same reader.
  const p = patchQr([WIFI], { name: "wifi", points: "WIFI:T:WPA;S:Bakery;P:sour;dough;;" });
  assert.equal(p.ok, false, JSON.stringify(p));
});

test("A31-6: a code shown through a component a page renders is placed; one in a component nothing renders is not", async () => {
  const { qrShownSources } = await import("../builder/site-add.mjs");
  const { qrUnplaced } = await import("../builder/site-qr-list.mjs");
  const page = (path, body) => ({ path, source: "import { createFileRoute } from '@tanstack/react-router'\n" + body });
  const pages = [page("index.tsx", "<main/>"), page("visit.tsx", "import { QrCard } from '@/routes/-parts/qr-card'\n<QrCard/>")];
  const card = { name: "qr-card", source: "import { SITE_QRS } from '@/site-brand'\nexport function QrCard(){ return <img src={SITE_QRS.wifi.src}/> }" };
  const orphan = { name: "qr-spare", source: "import { SITE_QRS } from '@/site-brand'\nexport function Spare(){ return <img src={SITE_QRS.ring.src}/> }" };
  const codes = [{ name: "wifi" }, { name: "ring" }];
  assert.deepEqual(qrUnplaced(codes, qrShownSources(pages, [card, orphan])), ["ring"]);
  // THE OLD READING, pages alone, called the wifi code unplaced.
  assert.deepEqual(qrUnplaced(codes, pages), ["wifi", "ring"]);
});
