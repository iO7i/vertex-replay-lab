# Invariants

This lab is intentionally small. Each public claim maps to an executable test.

| Invariant | Test |
| --- | --- |
| Provider-specific payloads map to one versioned canonical shape. | `provider-specific payloads become deterministic canonical records` |
| Irrelevant object-key ordering cannot change the canonical record or digest. | `irrelevant object-key ordering preserves the canonical representation and digest` |
| A repeated delivery with the same canonical mutation cannot create a second effect. | `duplicate delivery creates one intended effect` |
| A conflicting payload under an existing event identity is rejected. | `conflicting replay is rejected without replacing the original receipt` |
| A tenant cannot admit an event belonging to another tenant. | `tenant authority is checked before an effect can be admitted` |
| A committed effect whose acknowledgement is lost is reconciled without a second effect. | `effect committed before acknowledgement loss is reconciled without a second effect` |
| Restarting from recorded state preserves the idempotency invariant. | `restart and recovery preserve the idempotency invariant` |
| Malformed or unsupported schema input is rejected before an effect. | `malformed or unsupported schema input fails closed` |
| Replaying the same workload produces the same receipt digest. | `replaying the complete workload produces the same receipt digest` |
| Duplicate-only schedules preserve one effect per mutation under varied order and multiplicity. | `property: duplicate-only schedules never exceed one effect per mutation` |

The implementation is an in-memory reference model. It does not claim durable storage, provider exactly-once delivery, cryptographic identity, or production throughput.
