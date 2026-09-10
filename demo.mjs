import { readFile } from "node:fs/promises";
import { ReplayLab, run } from "./replay.mjs";

const events = JSON.parse(await readFile(new URL("./fixtures/events.json", import.meta.url)));
const first = run(events);
const second = run(events);
const counts = first.results.reduce((groups, result) => {
  (groups[result.status] ??= []).push(result);
  return groups;
}, {});

console.log("VERTEX REPLAY LAB / SYNTHETIC WORKLOAD");
console.log(`Received events:              ${events.length}`);
console.log(`Applied business effects:     ${first.summary.effects}`);
console.log(`Duplicate deliveries:         ${counts.duplicate?.length ?? 0}`);
console.log(`Rejected conflicts:            ${first.summary.rejections.filter((r) => r.reason.includes("CONFLICTING")).length}`);
console.log(`Tenant-boundary rejections:   ${first.summary.rejections.filter((r) => r.reason === "TENANT_BOUNDARY").length}`);
console.log(`Replay digest:                 ${first.summary.replayDigest}`);
console.log(`Second-run digest:             ${second.summary.replayDigest}`);
console.log(`REPLAY MATCH:                 ${first.summary.replayDigest === second.summary.replayDigest ? "PASS" : "FAIL"}`);
console.log(`ONE EFFECT PER MUTATION:      ${first.summary.effects === 2 ? "PASS" : "FAIL"}`);
console.log(`TENANT BOUNDARY:              ${first.summary.rejections.some((r) => r.reason === "TENANT_BOUNDARY") ? "PASS" : "FAIL"}`);

const uncertainLab = new ReplayLab();
const uncertain = uncertainLab.applyWithLostAcknowledgement(events[0]);
const reconciled = uncertainLab.reconcile(events[0]);
const recoveredLab = ReplayLab.fromState(JSON.parse(JSON.stringify(uncertainLab.exportState())));
const recovered = recoveredLab.deliver(events[0]);
console.log(`ACK LOSS RECONCILIATION:       ${uncertain.status === "completion_unknown" && reconciled.status === "reconciled" && uncertainLab.summary().effects === 1 ? "PASS" : "FAIL"}`);
console.log(`RESTART IDEMPOTENCY:           ${recovered.status === "duplicate" && recoveredLab.summary().effects === 1 ? "PASS" : "FAIL"}`);

const malformed = structuredClone(events[0]);
delete malformed.payload.order.items;
const unsupported = structuredClone(events[0]);
unsupported.payload.schema_version = "99";
const failClosed = run([malformed, unsupported]);
console.log(`FAIL-CLOSED INPUTS:            ${failClosed.summary.effects === 0 && failClosed.results.every((item) => item.reason === "INVALID_EVENT") ? "PASS" : "FAIL"}`);
