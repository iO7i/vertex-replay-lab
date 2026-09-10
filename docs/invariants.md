# Invariants

This lab is intentionally small. Each public claim maps to an executable test.

| Invariant | Test |
| --- | --- |
| Provider-specific payloads map to one versioned canonical shape. | `provider-specific payloads become deterministic canonical records` |
| A repeated delivery with the same canonical mutation cannot create a second effect. | `duplicate delivery creates one intended effect` |
| A conflicting payload under an existing event identity is rejected. | `conflicting replay is rejected without replacing the original receipt` |
| A tenant cannot admit an event belonging to another tenant. | `tenant authority is checked before an effect can be admitted` |
| Replaying the same workload produces the same receipt digest. | `replaying the complete workload produces the same receipt digest` |

The implementation is an in-memory reference model. It does not claim durable storage, provider exactly-once delivery, cryptographic identity, or production throughput.
