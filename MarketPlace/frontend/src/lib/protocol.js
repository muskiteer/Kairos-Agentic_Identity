import { sign as edSign } from "@noble/ed25519";

function b64FromBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function hexToBytes(hex) {
  const clean = String(hex || "").replace(/^0x/, "");
  if (!clean) return new Uint8Array();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function canonicalizeForJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeForJson);
  if (value && typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      out[k] = canonicalizeForJson(value[k]);
    }
    return out;
  }
  return value;
}

export async function buildProtocolEnvelope({
  action,
  from_agent,
  to_agent,
  skill_id,
  schema_version,
  agentPrivateKeySeedHex,
  payload,
}) {
  const request_id = `req_${crypto.randomUUID()}`;
  const trace_id = `tr_${crypto.randomUUID()}`;
  const nonce = `n_${crypto.randomUUID()}`;
  // Timestamp must be milliseconds since epoch to match backend freshness checks.
  const timestamp = Date.now();

  // Field insertion order matters: backend builds the canonical string from this field order.
  const envelopeWithoutSignature = {
    request_id,
    trace_id,
    action,
    from_agent,
    to_agent: to_agent || "",
    skill_id,
    schema_version: schema_version || "1",
    nonce,
    timestamp,
  };

  const canonicalPayload = canonicalizeForJson(payload ?? {});
  const signatureText =
    JSON.stringify(envelopeWithoutSignature) + "::" + JSON.stringify(canonicalPayload);

  const messageBytes = new TextEncoder().encode(signatureText);
  const privSeedBytes = hexToBytes(agentPrivateKeySeedHex);

  // ed25519 sign returns raw bytes; backend expects base64 string.
  const sigBytes = await edSign(messageBytes, privSeedBytes);
  return {
    ...envelopeWithoutSignature,
    signature: b64FromBytes(sigBytes),
  };
}

