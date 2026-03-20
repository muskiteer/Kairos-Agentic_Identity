function hexFromBytes(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const clean = String(hex || "").replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function generatePseudonym(serviceID, agentPrivateKeySeedHex) {
  const service = String(serviceID || "");
  if (!service) throw new Error("serviceID must be non-empty");

  const keyBytes = hexToBytes(agentPrivateKeySeedHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const msg = new TextEncoder().encode("agentid:pseudonym:v1:" + service);
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  const sigBytes = new Uint8Array(sig);

  const hexSum = hexFromBytes(sigBytes);
  return "ps_v1_" + hexSum.slice(0, 24);
}

