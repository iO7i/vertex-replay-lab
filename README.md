# Vertex Replay Lab

Provider-neutral reference implementation for one narrow business invariant: repeated or reordered provider delivery must not create more than one intended effect, and no effect may cross a tenant boundary.

```text
provider payloads → canonical record → digest → receipt / effect boundary
                                      ↘ conflict / duplicate / tenant rejection
```

## Why

External providers retry, duplicate, reorder, and sometimes mutate deliveries. A network-level “exactly once” guarantee is not available to the application. This lab makes the application boundary explicit: canonicalize first, bind receipts to tenant authority, reject conflicting replays, and admit one effect per logical mutation.

## Demo

```bash
npm run demo
```

The demo uses only synthetic `merchant-a` and `merchant-b` payloads from two deliberately different provider formats. It prints the applied effect count, duplicate/conflict/tenant rejections, and two independently computed replay digests.

## Proof

```bash
npm test
```

The tests cover canonicalization, duplicate delivery, conflicting payload reuse, tenant isolation, and deterministic replay. The same workload is run twice; the replay digest must match.

## Scope

This is a clean-room engineering lab, not the private Vertex implementation. It contains no provider credentials, customer data, private schemas, application logic, or production infrastructure. The model is intentionally in-memory and does not claim durable storage, provider exactly-once delivery, cryptographic identity, or production throughput.

See [the invariant ledger](docs/invariants.md) for the claim-to-test mapping.

## License

MIT
