function prettify(name) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractTokens(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

const COSTS = {
  weather_api: 1,
  crypto_api: 1,
  research_api: 3,
  qr_api: 2,
  crypto_price: 1,
  qr_generate: 2,
};

const DEFAULT_FALLBACK_SKILLS = [
  { id: "weather_api", description: "Get weather insights for cities." },
  { id: "crypto_api", description: "Get latest BTC/ETH prices." },
  { id: "qr_api", description: "Generate QR from text or URL." },
  { id: "research_api", description: "Research and summarize a topic." },
];

function normalizeToSkill(item) {
  const rawName = item?.id || item?.name || "skill";
  const id = String(rawName);
  const m = item?.manifest || {};

  // Capability signals are optional; derive from description/name when missing.
  const derivedCapabilities = unique([
    ...extractTokens(String(item?.description || "")),
    ...extractTokens(id),
  ]);

  const capabilities = m?.capabilities?.length
    ? m.capabilities
    : derivedCapabilities;

  const cost = Number(item?.cost ?? item?.price ?? COSTS[id] ?? 1);

  return {
    id,
    label: prettify(id),
    description: item?.description || "No description available.",
    cost,
    manifest: {
      name: m?.name || item?.name || id,
      version: m?.version || item?.version || "v1",
      schemaVersion: m?.schema_version || m?.schemaVersion || item?.schemaVersion || "1",
      inputSchema: m?.input_schema || m?.inputSchema || item?.inputSchema || null,
      outputSchema: m?.output_schema || m?.outputSchema || item?.outputSchema || null,
      latencyMs: Number(m?.latency_ms ?? m?.latencyMs ?? item?.latencyMs ?? 250),
      auth: m?.auth || item?.auth || null,
      reputation: Number(m?.reputation ?? item?.reputation ?? item?.trustScore ?? 0.5),
      availability: Number(m?.availability ?? item?.availability ?? 0.95),
      capabilities,
    },
  };
}

export async function fetchSkills(API_BASE) {
  try {
    const res = await fetch(`${API_BASE}/skills`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        return data.map(normalizeToSkill);
      }
    }
  } catch {
    // ignore; fallback handled below
  }

  // Backward compatible: current backend demo still exposes /tools.
  try {
    const res = await fetch(`${API_BASE}/tools`);
    if (!res.ok) throw new Error("Failed to fetch tools");
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      return data.map((t) => normalizeToSkill({ ...t, id: t?.name || t?.id }));
    }
  } catch {
    // ignore; fallback handled below
  }

  return DEFAULT_FALLBACK_SKILLS.map((s) => normalizeToSkill(s));
}

export function rankSkills(skills, userText) {
  const tokens = extractTokens(userText);
  const skillsArr = Array.isArray(skills) ? skills : [];
  if (!skillsArr.length) return [];

  const maxCost = Math.max(...skillsArr.map((s) => s.cost || 1), 1);
  const maxLatency = Math.max(...skillsArr.map((s) => s.manifest?.latencyMs || 1), 1);

  return skillsArr
    .map((s) => {
      const capTokens = extractTokens((s.manifest?.capabilities || []).join(" "));

      const intersection = capTokens.filter((t) => tokens.includes(t));
      const capabilityMatch = capTokens.length ? intersection.length / capTokens.length : 0;

      const costPenalty = (s.cost || 1) / maxCost;
      const latencyPenalty = (s.manifest?.latencyMs || 0) / maxLatency;
      const reputation = Number(s.manifest?.reputation ?? 0.5);
      const availability = Number(s.manifest?.availability ?? 0.95);

      // Simple weighted score; tuned to be stable for demo purposes.
      const score =
        capabilityMatch * 0.55 +
        reputation * 0.18 +
        availability * 0.12 -
        costPenalty * 0.18 -
        latencyPenalty * 0.07;

      return { skill: s, score };
    })
    .sort((a, b) => b.score - a.score);
}

