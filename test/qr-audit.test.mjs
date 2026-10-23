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
  // …and a stored undrawable code carried along by a patch to another stays.
  const patched = [PAY, { ...WIFI, label: "Join us" }];
  assert.deepEqual(mergeLook({ qr: stored }, { qr: patched }, {}, { instructed: true, asked: true }).qr.map((c) => c.name), ["pay", "wifi"]);
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

test("A31-4: the qr lane's patch resolves a bare route against the site's address and refuses a page the site lacks, in either spelling", async () => {
  const { qrDestinationCheck } = await import("../builder/site-add.mjs");
  const RING = [{ name: "ring", points: "tel:0114", label: "Ring us" }, WIFI];
  const check = qrDestinationCheck({ base: "https://fold.gofarther.app", routes: ["/", "/booking"] });
  const ok = patchQr(RING, { name: "ring", points: "/booking" }, { check });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.list[0].points, "https://fold.gofarther.app/booking");
  for (const bad of ["/nope", "https://fold.gofarther.app/nope"]) {
    const r = patchQr(RING, { name: "ring", points: bad }, { check });
    assert.equal(r.ok, false, bad);
    assert.equal(r.why, "no-such-page", bad);
  }
  const blind = patchQr(RING, { name: "ring", points: "/booking" }, { check: qrDestinationCheck({ base: "", routes: ["/booking"] }) });
  assert.equal(blind.why, "no-address");
  // OTHER DESTINATIONS PASS UNTOUCHED, and a caption-only patch is not checked.
  assert.equal(patchQr(RING, { name: "ring", points: "https://instagram.com/fold" }, { check }).list[0].points, "https://instagram.com/fold");
  assert.equal(patchQr(RING, { name: "ring", label: "Call the bakery" }, { check }).ok, true);
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
