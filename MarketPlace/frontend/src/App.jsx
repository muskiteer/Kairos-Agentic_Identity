import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getPublicKeyAsync, utils as edUtils } from "@noble/ed25519";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Visualize from "./pages/Visualize";
import AI from "./pages/AI";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import { buildProtocolEnvelope } from "./lib/protocol";
import { generatePseudonym } from "./lib/pseudonym";
import { getApiBaseUrl } from "./lib/api";

const API_BASE = getApiBaseUrl();

// Storage model: identity is local-only (private seed stays in the browser),
// wallet/credits is separate. We also keep identity/credits per agentId.
const IDENTITY_MAP_KEY = "kairos.identityMap";
const WALLET_MAP_KEY = "kairos.walletMap";
const DESC_MAP_KEY = "kairos.descMap";
const CURRENT_AGENT_ID_KEY = "kairos.currentAgentId";

const HISTORY_PSEUDONYMS_MAP_KEY = "kairos.history.pseudonymsByAgent";
const HISTORY_LAST_PSEUDONYM_MAP_KEY = "kairos.history.lastPseudonymByAgent";

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const clean = String(hex || "").replace(/^0x/, "");
  if (!clean || clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export default function App() {
  const [identity, setIdentity] = useState(() => {
    const currentAgentId = localStorage.getItem(CURRENT_AGENT_ID_KEY) || "";
    if (!currentAgentId) return { agentId: "", privateKeySeedHex: "", publicKeyHex: "" };
    const identityMap = loadJson(IDENTITY_MAP_KEY, {});
    return {
      agentId: currentAgentId,
      privateKeySeedHex: identityMap?.[currentAgentId]?.privateKeySeedHex || "",
      publicKeyHex: identityMap?.[currentAgentId]?.publicKeyHex || "",
    };
  });

  const [credits, setCredits] = useState(() => {
    const currentAgentId = localStorage.getItem(CURRENT_AGENT_ID_KEY) || "";
    const walletMap = loadJson(WALLET_MAP_KEY, {});
    return walletMap?.[currentAgentId]?.credits ?? 100;
  });

  const [agentDescription, setAgentDescription] = useState(() => {
    const currentAgentId = localStorage.getItem(CURRENT_AGENT_ID_KEY) || "";
    const descMap = loadJson(DESC_MAP_KEY, {});
    return descMap?.[currentAgentId] ?? "";
  });

  const [pseudonymsByService, setPseudonymsByService] = useState(() => {
    const currentAgentId = localStorage.getItem(CURRENT_AGENT_ID_KEY) || "";
    const historyMap = loadJson(HISTORY_PSEUDONYMS_MAP_KEY, {});
    return historyMap?.[currentAgentId] ?? {};
  });

  const [lastPseudonym, setLastPseudonym] = useState(() => {
    const currentAgentId = localStorage.getItem(CURRENT_AGENT_ID_KEY) || "";
    const lastMap = loadJson(HISTORY_LAST_PSEUDONYM_MAP_KEY, {});
    return lastMap?.[currentAgentId] ?? "";
  });

  const [uiError, setUiError] = useState("");

  useEffect(() => {
    if (!identity?.agentId) return;
    const identityMap = loadJson(IDENTITY_MAP_KEY, {});
    identityMap[identity.agentId] = {
      privateKeySeedHex: identity.privateKeySeedHex,
      publicKeyHex: identity.publicKeyHex,
    };
    saveJson(IDENTITY_MAP_KEY, identityMap);

    const walletMap = loadJson(WALLET_MAP_KEY, {});
    walletMap[identity.agentId] = { credits };
    saveJson(WALLET_MAP_KEY, walletMap);

    const descMap = loadJson(DESC_MAP_KEY, {});
    descMap[identity.agentId] = agentDescription;
    saveJson(DESC_MAP_KEY, descMap);

    const historyMap = loadJson(HISTORY_PSEUDONYMS_MAP_KEY, {});
    historyMap[identity.agentId] = pseudonymsByService;
    saveJson(HISTORY_PSEUDONYMS_MAP_KEY, historyMap);

    const lastMap = loadJson(HISTORY_LAST_PSEUDONYM_MAP_KEY, {});
    lastMap[identity.agentId] = lastPseudonym;
    saveJson(HISTORY_LAST_PSEUDONYM_MAP_KEY, lastMap);
  }, [identity, credits, agentDescription, pseudonymsByService, lastPseudonym]);

  const createAgent = async () => {
    setUiError("");
    // 1) Generate ed25519 keypair locally (private seed never leaves browser).
    const privateKeySeedBytes =
      typeof edUtils.randomSecretKey === "function"
        ? edUtils.randomSecretKey()
        : edUtils.randomPrivateKey(); // fallback for older versions
    const publicKeyBytes = await getPublicKeyAsync(privateKeySeedBytes); // 32 bytes

    const privateKeySeedHex = bytesToHex(privateKeySeedBytes);
    const publicKeyHex = bytesToHex(publicKeyBytes);
    const agentId = await sha256Hex(publicKeyBytes); // tie identity to cryptography

    // 2) Update local state + storage maps.
    setIdentity({ agentId, privateKeySeedHex, publicKeyHex });
    setCredits(100);
    setLastPseudonym("");
    setPseudonymsByService({});
    localStorage.setItem(CURRENT_AGENT_ID_KEY, agentId);

    // 3) Persist agent metadata to Mongo (public key for signature verification).
    try {
      const registerRes = await fetch(`${API_BASE}/agent/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          public_key: publicKeyHex,
          description: agentDescription,
          role: "user",
          allowed_skills: [],
        }),
      });
      if (registerRes.ok) {
        const registered = await registerRes.json().catch(() => null);
        if (Number.isFinite(Number(registered?.credits))) {
          setCredits(Number(registered.credits));
        }
      }
    } catch {
      // Backend is optional for demo; signature verification won't work without backend registration.
    }
  };

  const loadAgent = async (id) => {
    setUiError("");
    if (!id?.trim()) return;

    const agentId = id.trim();
    const identityMap = loadJson(IDENTITY_MAP_KEY, {});
    const record = identityMap?.[agentId];
    if (!record?.privateKeySeedHex || !record?.publicKeyHex) {
      setUiError("Private key not found in this browser. Create the agent first.");
      return;
    }

    setIdentity({ agentId, privateKeySeedHex: record.privateKeySeedHex, publicKeyHex: record.publicKeyHex });
    localStorage.setItem(CURRENT_AGENT_ID_KEY, agentId);

    const walletMap = loadJson(WALLET_MAP_KEY, {});
    setCredits(walletMap?.[agentId]?.credits ?? 100);

    const descMap = loadJson(DESC_MAP_KEY, {});
    setAgentDescription(descMap?.[agentId] ?? "");

    const historyMap = loadJson(HISTORY_PSEUDONYMS_MAP_KEY, {});
    setPseudonymsByService(historyMap?.[agentId] ?? {});

    const lastMap = loadJson(HISTORY_LAST_PSEUDONYM_MAP_KEY, {});
    setLastPseudonym(lastMap?.[agentId] ?? "");

    // Optional: fetch description from backend (if the user previously registered).
    try {
      const infoRes = await fetch(`${API_BASE}/agent/info?agent_id=${encodeURIComponent(agentId)}`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        if (typeof info?.description === "string") setAgentDescription(info.description);
        if (Number.isFinite(Number(info?.credits))) {
          setCredits(Number(info.credits));
        }
      }
    } catch {
      // ignore
    }
  };

  const executeSkill = async (skill, payload, cost) => {
    const skillId = skill?.id || String(skill);
    const schemaVersion = skill?.manifest?.schemaVersion || "1";
    if (!identity?.agentId || !identity?.privateKeySeedHex) {
      return { ok: false, error: "Create or load an agent first." };
    }
    if (credits < cost) return { ok: false, error: "Insufficient credits." };

    const pseudonym = await generatePseudonym(skillId, identity.privateKeySeedHex);
    const protocol = await buildProtocolEnvelope({
      action: "execute",
      from_agent: identity.agentId,
      to_agent: "",
      skill_id: skillId,
      schema_version: schemaVersion,
      agentPrivateKeySeedHex: identity.privateKeySeedHex,
      payload,
    });

    try {
      const endpointSkill = `${API_BASE}/skills/${encodeURIComponent(skillId)}`;
      const body = {
        protocol,
        agentId: identity.agentId,
        pseudonym,
        payload,
      };

      const response = await fetch(endpointSkill, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = { message: "No JSON response body received." };
      }

      if (!response.ok) {
        return { ok: false, error: data?.error || `Request failed (${response.status})` };
      }

      const returnedPseudonym = typeof data?.pseudonym === "string" ? data.pseudonym : pseudonym;
      const output = data?.output ?? data?.result ?? data;

      setCredits((prev) => prev - cost);
      setLastPseudonym(returnedPseudonym);
      setPseudonymsByService((prev) => {
        const existing = prev[skillId] || [];
        return {
          ...prev,
          [skillId]: [returnedPseudonym, ...existing].slice(0, 8),
        };
      });

      return { ok: true, data: output, pseudonym: returnedPseudonym };
    } catch {
      return { ok: false, error: "Network error while calling API." };
    }
  };

  const registerAgentSkills = async ({ skillsText, price, endpoint, inputExample }) => {
    if (!identity?.agentId) {
      return { ok: false, error: "Create or load an agent first." };
    }

    const skills = String(skillsText || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const normalizedPrice = Number(price);
    if (!skills.length || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return { ok: false, error: "Provide skills (comma-separated) and a positive price." };
    }

    try {
      const response = await fetch(`${API_BASE}/agent/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: identity.agentId,
          skills,
          price: normalizedPrice,
          endpoint: String(endpoint || "").trim(),
          method: "POST",
          input_example: (() => {
            const raw = String(inputExample || "").trim();
            if (!raw) return undefined;
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") return parsed;
            } catch {
              // fallback below
            }
            return { input: raw };
          })(),
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        return { ok: false, error: data?.error || `Request failed (${response.status})` };
      }

      return { ok: true, data };
    } catch {
      return { ok: false, error: "Network error while registering skills." };
    }
  };

  const exportAgentBackup = () => {
    if (!identity?.agentId || !identity?.privateKeySeedHex || !identity?.publicKeyHex) {
      return { ok: false, error: "Create or load an agent first." };
    }

    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      agent_id: identity.agentId,
      public_key: identity.publicKeyHex,
      private_key_seed: identity.privateKeySeedHex,
      description: agentDescription || "",
      credits,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-backup-${identity.agentId.slice(0, 12)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return { ok: true };
  };

  const importAgentBackup = async (backup) => {
    setUiError("");
    if (!backup || typeof backup !== "object") {
      return { ok: false, error: "Invalid backup JSON." };
    }

    const agentId = String(backup.agent_id || "").trim();
    const publicKeyHex = String(backup.public_key || "").trim().toLowerCase();
    const privateKeySeedHex = String(backup.private_key_seed || "").trim().toLowerCase();
    const description = String(backup.description || "");
    const importedCredits = Number(backup.credits);

    const isHex64 = (v) => /^[0-9a-f]{64}$/i.test(v);
    if (!agentId || !isHex64(publicKeyHex) || !isHex64(privateKeySeedHex)) {
      return {
        ok: false,
        error: "Backup must include valid agent_id, public_key (32-byte hex), and private_key_seed (32-byte hex).",
      };
    }

    const derivedAgentId = await sha256Hex(hexToBytes(publicKeyHex));
    if (derivedAgentId !== agentId) {
      return { ok: false, error: "Backup validation failed: agent_id does not match public_key." };
    }

    setIdentity({ agentId, privateKeySeedHex, publicKeyHex });
    setCredits(Number.isFinite(importedCredits) && importedCredits >= 0 ? importedCredits : 100);
    setAgentDescription(description);
    setLastPseudonym("");
    setPseudonymsByService({});
    localStorage.setItem(CURRENT_AGENT_ID_KEY, agentId);

    try {
      const registerRes = await fetch(`${API_BASE}/agent/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          public_key: publicKeyHex,
          description,
          role: "user",
          allowed_skills: [],
        }),
      });

      if (registerRes.ok) {
        const registered = await registerRes.json().catch(() => null);
        if (Number.isFinite(Number(registered?.credits))) {
          setCredits(Number(registered.credits));
        }
      }
    } catch {
      // ignore backend sync failures for local import
    }

    return { ok: true };
  };

  const sharedProps = useMemo(
    () => ({
      agentId: identity?.agentId || "",
      credits,
      lastPseudonym,
      description: agentDescription,
      agentDescription,
      pseudonymsByService,
      createAgent,
      loadAgent,
      setAgentDescription,
      executeSkill,
      registerAgentSkills,
      exportAgentBackup,
      importAgentBackup,
      uiError,
    }),
    [identity, credits, lastPseudonym, pseudonymsByService, agentDescription, uiError]
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(2,6,23,0.96),rgba(15,23,42,0.95),rgba(2,6,23,0.96))]" />

      <Navbar credits={credits} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        {uiError ? (
          <div className="mb-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-sm text-[#ef4444]">
            {uiError}
          </div>
        ) : null}

        <Routes>
          <Route path="/" element={<Home {...sharedProps} />} />
          <Route path="/marketplace" element={<Marketplace {...sharedProps} />} />
          <Route path="/visualize" element={<Visualize {...sharedProps} />} />
          <Route path="/ai" element={<AI {...sharedProps} />} />
          <Route path="/developer" element={<DeveloperDashboard {...sharedProps} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
