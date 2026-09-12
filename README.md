# Vertex Replay Lab

This Node.js lab runs a provider-delivery failure case end to end. A provider can retry or reorder the same mutation, reuse an identity with different data, deliver it under the wrong tenant, or complete the effect just before its acknowledgement is lost. The lab accepts one intended effect, rejects the unsafe cases, and recovers without applying the effect twice.

```text
provider payloads → canonical record → digest → receipt / effect boundary
                                      ↘ conflict / duplicate / tenant rejection
```

## What it checks

The application cannot get an exactly-once network guarantee from an external provider. It canonicalizes each input before hashing, binds receipts to tenant authority, rejects conflicting reuse of an identity, and admits one effect per logical mutation.

## Demo

Requires Node.js 22 or 24. These are the supported LTS runtime lines for this lab; other major versions are outside the compatibility contract.

```bash
npm run demo
```

The demo uses synthetic `merchant-a` and `merchant-b` payloads from two different provider formats. It prints the applied-effect count, duplicate/conflict/tenant rejections, acknowledgement-loss reconciliation, restart recovery, fail-closed input handling, and two independently computed replay digests.

## Proof

```bash
npm test
```

The tests cover canonicalization, irrelevant key ordering, duplicate delivery, conflicting payload reuse, tenant isolation, acknowledgement-loss reconciliation, restart recovery, malformed/unsupported input rejection, deterministic replay, and a property-style duplicate schedule. The same workload is run twice; the replay digest must match.

## Setup

This is a dependency-free Node.js reference lab. After cloning it, run:

```bash
npm test
npm run demo
```

GitHub Actions runs both Node.js 22 and Node.js 24 for every push and pull request.

## Scope

This is a clean-room engineering lab, not the private Vertex implementation. It contains no provider credentials, customer data, private schemas, application logic, or production infrastructure. The model is intentionally in-memory and does not claim durable storage, provider exactly-once delivery, cryptographic identity, or production throughput.

See [the invariant ledger](docs/invariants.md) for the claim-to-test mapping.

## License

MIT
