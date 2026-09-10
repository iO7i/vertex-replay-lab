import { canonicalize, sha256 } from "./src/canonical.mjs";

export class ReplayLab {
  constructor() {
    this.receipts = new Map();
    this.effects = new Map();
    this.rejections = [];
  }

  deliver(event) {
    let record;
    try {
      record = canonicalize(event);
    } catch (error) {
      const result = { status: "rejected", reason: "INVALID_EVENT", detail: error.message };
      this.rejections.push(result);
      return result;
    }

    if (record.actorTenant !== record.canonical.tenantId) {
      const result = { status: "rejected", reason: "TENANT_BOUNDARY", eventKey: record.eventKey };
      this.rejections.push(result);
      return result;
    }

    const priorReceipt = this.receipts.get(record.eventKey);
    if (priorReceipt) {
      if (priorReceipt.digest === record.digest) return { status: "duplicate", eventKey: record.eventKey };
      const result = { status: "rejected", reason: "CONFLICTING_REPLAY", eventKey: record.eventKey };
      this.rejections.push(result);
      return result;
    }

    const priorEffect = this.effects.get(record.mutationKey);
    if (priorEffect) {
      if (priorEffect.digest === record.digest) {
        this.receipts.set(record.eventKey, { digest: record.digest, mutationKey: record.mutationKey });
        return { status: "duplicate", eventKey: record.eventKey };
      }
      const result = { status: "rejected", reason: "CONFLICTING_MUTATION", eventKey: record.eventKey };
      this.rejections.push(result);
      return result;
    }

    this.receipts.set(record.eventKey, { digest: record.digest, mutationKey: record.mutationKey });
    this.effects.set(record.mutationKey, { digest: record.digest, entity: record.canonical.entity });
    return { status: "applied", eventKey: record.eventKey, mutationKey: record.mutationKey };
  }

  applyWithLostAcknowledgement(event) {
    const result = this.deliver(event);
    if (result.status !== "applied") return result;
    return {
      status: "completion_unknown",
      effectCommitted: true,
      eventKey: result.eventKey,
      mutationKey: result.mutationKey,
    };
  }

  reconcile(event) {
    const result = this.deliver(event);
    if (result.status === "duplicate") return { status: "reconciled", eventKey: result.eventKey };
    return result;
  }

  exportState() {
    return {
      receipts: [...this.receipts.entries()].sort(([a], [b]) => a.localeCompare(b)),
      effects: [...this.effects.entries()].sort(([a], [b]) => a.localeCompare(b)),
      rejections: this.rejections,
    };
  }

  static fromState(state) {
    if (!state || !Array.isArray(state.receipts) || !Array.isArray(state.effects) || !Array.isArray(state.rejections)) {
      throw new Error("invalid replay state");
    }
    const lab = new ReplayLab();
    lab.receipts = new Map(state.receipts);
    lab.effects = new Map(state.effects);
    lab.rejections = structuredClone(state.rejections);
    return lab;
  }

  summary() {
    const effectLedger = [...this.effects.entries()].sort(([a], [b]) => a.localeCompare(b));
    const receipts = [...this.receipts.entries()].sort(([a], [b]) => a.localeCompare(b));
    return {
      receipts: receipts.length,
      effects: effectLedger.length,
      replayDigest: sha256({ receipts, effects: effectLedger }),
      effectLedger,
      rejections: this.rejections,
    };
  }
}

export function run(events) {
  const lab = new ReplayLab();
  const results = events.map((event) => lab.deliver(event));
  return { results, summary: lab.summary() };
}
