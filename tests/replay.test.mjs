import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalize } from "../src/canonical.mjs";
import { ReplayLab, run } from "../replay.mjs";

const events = JSON.parse(await readFile(new URL("../fixtures/events.json", import.meta.url)));

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseObjectKeys(item)]));
  }
  return value;
}

test("provider-specific payloads become deterministic canonical records", () => {
  const northwind = canonicalize(events[0]);
  const desertCart = canonicalize(events[2]);
  assert.equal(northwind.canonical.schemaVersion, "order.v1");
  assert.equal(northwind.canonical.tenantId, "merchant-a");
  assert.equal(desertCart.canonical.entity.currency, "SAR");
  assert.equal(canonicalize(structuredClone(events[0])).digest, northwind.digest);
});

test("irrelevant object-key ordering preserves the canonical representation and digest", () => {
  const original = canonicalize(events[0]);
  const reordered = canonicalize(reverseObjectKeys(events[0]));
  assert.deepEqual(reordered.canonical, original.canonical);
  assert.equal(reordered.digest, original.digest);
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

test("effect committed before acknowledgement loss is reconciled without a second effect", () => {
  const lab = new ReplayLab();
  const uncertain = lab.applyWithLostAcknowledgement(events[0]);
  assert.equal(uncertain.status, "completion_unknown");
  assert.equal(uncertain.effectCommitted, true);
  const reconciled = lab.reconcile(events[0]);
  assert.equal(reconciled.status, "reconciled");
  assert.equal(lab.summary().effects, 1);
});

test("restart and recovery preserve the idempotency invariant", () => {
  const beforeRestart = new ReplayLab();
  assert.equal(beforeRestart.deliver(events[0]).status, "applied");
  const recovered = ReplayLab.fromState(JSON.parse(JSON.stringify(beforeRestart.exportState())));
  assert.equal(recovered.deliver(events[0]).status, "duplicate");
  assert.equal(recovered.summary().effects, 1);
});

test("malformed or unsupported schema input fails closed", () => {
  const malformed = structuredClone(events[0]);
  delete malformed.payload.order.items;
  const unsupported = structuredClone(events[0]);
  unsupported.payload.schema_version = "99";
  const result = run([malformed, unsupported]);
  assert.deepEqual(result.results.map((item) => [item.status, item.reason]), [
    ["rejected", "INVALID_EVENT"],
    ["rejected", "INVALID_EVENT"],
  ]);
  assert.equal(result.summary.effects, 0);
});

test("replaying the complete workload produces the same receipt digest", () => {
  const first = run(events);
  const second = run(events);
  assert.equal(first.summary.effects, 2);
  assert.equal(first.summary.replayDigest, second.summary.replayDigest);
  assert.equal(first.summary.rejections.filter((r) => r.reason === "TENANT_BOUNDARY").length, 1);
});

test("property: duplicate-only schedules never exceed one effect per mutation", () => {
  let state = 0x12345678;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };

  for (let trial = 0; trial < 128; trial += 1) {
    const schedule = [];
    for (const event of [events[0], events[2]]) {
      const copies = 1 + (next() % 6);
      for (let copy = 0; copy < copies; copy += 1) schedule.push(structuredClone(event));
    }
    for (let index = schedule.length - 1; index > 0; index -= 1) {
      const swap = next() % (index + 1);
      [schedule[index], schedule[swap]] = [schedule[swap], schedule[index]];
    }

    const result = run(schedule);
    assert.equal(result.summary.effects, 2);
    assert.equal(result.results.filter((item) => item.status === "applied").length, 2);
    assert.equal(result.results.filter((item) => item.status === "duplicate").length, schedule.length - 2);
  }
});
