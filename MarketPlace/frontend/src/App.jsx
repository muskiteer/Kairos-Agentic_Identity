import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Visualize from "./pages/Visualize";
import AI from "./pages/AI";

const AGENT_KEY = "kairos.agentId";
const CREDITS_KEY = "kairos.credits";
const PSEUDONYMS_KEY = "kairos.pseudonyms";
const LAST_PSEUDONYM_KEY = "kairos.lastPseudonym";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function generateAgentId() {
  return `agent-${Math.random().toString(36).slice(2, 10)}`;
}

function generatePseudonym(service) {
  const base = service.replace(/_api|_price|_generate/g, "").slice(0, 4) || "anon";
  return `psn-${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_KEY) || "");
  const [credits, setCredits] = useState(() => Number(localStorage.getItem(CREDITS_KEY)) || 100);
  const [lastPseudonym, setLastPseudonym] = useState(() => localStorage.getItem(LAST_PSEUDONYM_KEY) || "");
  const [pseudonymsByService, setPseudonymsByService] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PSEUDONYMS_KEY) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => localStorage.setItem(AGENT_KEY, agentId), [agentId]);
  useEffect(() => localStorage.setItem(CREDITS_KEY, String(credits)), [credits]);
  useEffect(() => localStorage.setItem(LAST_PSEUDONYM_KEY, lastPseudonym), [lastPseudonym]);
  useEffect(() => {
    localStorage.setItem(PSEUDONYMS_KEY, JSON.stringify(pseudonymsByService));
  }, [pseudonymsByService]);

  const createAgent = () => {
    setAgentId(generateAgentId());
    setCredits(100);
    setLastPseudonym("");
    setPseudonymsByService({});
  };

  const loadAgent = (id) => {
    if (!id?.trim()) return;
    setAgentId(id.trim());
    if (!localStorage.getItem(CREDITS_KEY)) {
      setCredits(100);
    }
  };

  const executeTool = async (tool, payload, cost) => {
    if (!agentId) {
      return { ok: false, error: "Create or load an agent first." };
    }
    if (credits < cost) {
      return { ok: false, error: "Insufficient credits." };
    }

    const pseudonym = generatePseudonym(tool);

    try {
      const response = await fetch(`${API_BASE}/tools/${tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          pseudonym,
          ...payload,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        data = { message: "No JSON response body received." };
      }

      if (!response.ok) {
        return { ok: false, error: data?.error || `Request failed (${response.status})` };
      }

      setCredits((prev) => prev - cost);
      setLastPseudonym(pseudonym);
      setPseudonymsByService((prev) => {
        const existing = prev[tool] || [];
        return {
          ...prev,
          [tool]: [pseudonym, ...existing].slice(0, 8),
        };
      });

      return { ok: true, data, pseudonym };
    } catch {
      return { ok: false, error: "Network error while calling API." };
    }
  };

  const sharedProps = useMemo(
    () => ({
      agentId,
      credits,
      lastPseudonym,
      pseudonymsByService,
      createAgent,
      loadAgent,
      executeTool,
    }),
    [agentId, credits, lastPseudonym, pseudonymsByService]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.14),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(167,139,250,0.12),transparent_40%)] animate-pulse-slow" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(2,6,23,0.96),rgba(15,23,42,0.95),rgba(2,6,23,0.96))]" />

      <Navbar credits={credits} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home {...sharedProps} />} />
          <Route path="/marketplace" element={<Marketplace {...sharedProps} />} />
          <Route path="/visualize" element={<Visualize {...sharedProps} />} />
          <Route path="/ai" element={<AI {...sharedProps} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
