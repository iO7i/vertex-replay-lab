import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableJson(value) {
  return stable(value);
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

function requireString(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`invalid ${field}`);
  return value;
}

function requireInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid ${field}`);
  return value;
}

function canonicalLines(lines) {
  if (!Array.isArray(lines)) throw new Error("invalid order lines");
  return lines.map((line) => ({
    productId: requireString(line.productId, "product id"),
    quantity: requireInteger(line.quantity, "quantity"),
    unitPriceMinor: requireInteger(line.unitPriceMinor, "unit price"),
  }));
}

export function canonicalize(event) {
  const actorTenant = requireString(event.actorTenant, "actor tenant");
  const provider = requireString(event.provider, "provider");
  const raw = event.payload;
  if (!raw || typeof raw !== "object") throw new Error("invalid payload");

  let providerEventId;
  let tenantId;
  let entity;

  if (provider === "northwind") {
    providerEventId = requireString(raw.event_id, "provider event id");
    tenantId = requireString(raw.store_id, "tenant id");
    if (raw.type !== "order.created") throw new Error("unsupported northwind event");
    entity = raw.order;
    entity = {
      id: requireString(entity?.id, "order id"),
      status: requireString(entity?.status, "order status"),
      totalMinor: requireInteger(entity?.total_minor, "order total"),
      currency: requireString(entity?.currency, "currency"),
      lines: canonicalLines(entity?.items),
    };
  } else if (provider === "desert-cart") {
    providerEventId = requireString(raw.id, "provider event id");
    tenantId = requireString(raw.merchant, "tenant id");
    if (raw.kind !== "order_created") throw new Error("unsupported desert-cart event");
    entity = raw.order;
    entity = {
      id: requireString(entity?.order_number, "order id"),
      status: requireString(entity?.status, "order status"),
      totalMinor: requireInteger(entity?.grand_total_minor, "order total"),
      currency: requireString(entity?.currency_code, "currency"),
      lines: canonicalLines(entity?.lines),
    };
  } else {
    throw new Error(`unsupported provider ${provider}`);
  }

  const canonical = {
    schemaVersion: "order.v1",
    tenantId,
    eventType: "order.created",
    entity,
  };

  return {
    actorTenant,
    provider,
    providerEventId,
    canonical,
    digest: sha256(canonical),
    eventKey: `${tenantId}:${provider}:${providerEventId}`,
    mutationKey: `${tenantId}:${canonical.eventType}:${entity.id}`,
  };
}
