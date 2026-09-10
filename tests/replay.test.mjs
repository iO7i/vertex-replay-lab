import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalize } from "../src/canonical.mjs";
import { run } from "../replay.mjs";

const events = JSON.parse(await readFile(new URL("../fixtures/events.json", import.meta.url)));

test("provider-specific payloads become deterministic canonical records", () => {
  const northwind = canonicalize(events[0]);
  const desertCart = canonicalize(events[2]);
  assert.equal(northwind.canonical.schemaVersion, "order.v1");
  assert.equal(northwind.canonical.tenantId, "merchant-a");
  assert.equal(desertCart.canonical.entity.currency, "SAR");
  assert.equal(canonicalize(structuredClone(events[0])).digest, northwind.digest);
});

test("duplicate delivery creates one intended effect", () => {
  const result = run(events.slice(0, 2));
  assert.equal(result.summary.effects, 1);
  assert.deepEqual(result.results.map((item) => item.status), ["applied", "duplicate"]);
});

test("conflicting replay is rejected without replacing the original receipt", () => {
  const result = run([events[0], events[3]]);
  assert.equal(result.summary.effects, 1);
  assert.equal(result.results[1].reason, "CONFLICTING_REPLAY");
});

test("tenant authority is checked before an effect can be admitted", () => {
  const result = run([events[4]]);
  assert.equal(result.summary.effects, 0);
  assert.equal(result.results[0].reason, "TENANT_BOUNDARY");
});

test("replaying the complete workload produces the same receipt digest", () => {
  const first = run(events);
  const second = run(events);
  assert.equal(first.summary.effects, 2);
  assert.equal(first.summary.replayDigest, second.summary.replayDigest);
  assert.equal(first.summary.rejections.filter((r) => r.reason === "TENANT_BOUNDARY").length, 1);
});
