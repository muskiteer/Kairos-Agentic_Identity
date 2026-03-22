import { useEffect, useState } from "react";
import AgentInfo from "../components/AgentInfo";
import ChatBox from "../components/ChatBox";
import { fetchSkills, rankSkills } from "../lib/skills";
import { getApiBaseUrl } from "../lib/api";

const MIN_SKILL_SCORE = 0.2;
const GENERAL_FALLBACK_SKILL_ID = "research_api";

async function pickSkillViaBackendRouter(agentId, userText, skills) {
  if (!agentId || !userText || !Array.isArray(skills) || skills.length === 0) {
    return null;
  }

  const API_BASE = getApiBaseUrl();
  try {
    const res = await fetch(`${API_BASE}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        message: userText,
        skills: skills.map((s) => ({
          id: s?.id,
          description: s?.description || s?.manifest?.description || "",
          capabilities: Array.isArray(s?.manifest?.capabilities) ? s.manifest.capabilities : [],
        })),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const routedSkillId = String(data?.skill_id || "").trim();
    if (!routedSkillId) return null;

    const routedSkill = skills.find((s) => s?.id === routedSkillId);
    if (!routedSkill) return null;

    return {
      skill: routedSkill,
      reason: "backend-router",
      routeReason: String(data?.route_reason || ""),
    };
  } catch {
    return null;
  }
}

function formatSkillAnswer(skillId, output) {
  if (!output || typeof output !== "object") {
    return String(output ?? "No output received.");
  }

  if (skillId === "weather_api") {
    const city = output.city || "your location";
    const temp = output.temp_c ?? output.temperature_c ?? output.temperature;
    const condition = output.condition || output.weather || "Unknown conditions";

    if (temp !== undefined && temp !== null) {
      return `The current weather in ${city} is ${temp}°C with ${condition}.`;
    }
    return `The current weather in ${city} is ${condition}.`;
  }

  if (skillId === "crypto_api") {
    const asset = output.asset || "Crypto";
    const price = output.price_usd ?? output.price;
    if (price !== undefined && price !== null) {
      return `${asset} is currently around $${price}.`;
    }
    return `${asset} price data is available.`;
  }

  if (typeof output.message === "string" && output.message.trim()) {
    return output.message;
  }

  return "The request was completed successfully.";
}

function pickSkillForExecution(ranked, skills, userText) {
  const text = String(userText || "").toLowerCase();
  const allSkills = Array.isArray(skills) ? skills : [];

  const hasToken = (tokens) => tokens.some((t) => text.includes(t));
  const findSkill = (id) => allSkills.find((s) => s?.id === id);

  // Deterministic intent-first routing for common demo queries.
  if (hasToken(["bitcoin", "btc", "ethereum", "eth", "crypto", "price", "coin"])) {
    const cryptoSkill = findSkill("crypto_api");
    if (cryptoSkill) {
      return { skill: cryptoSkill, reason: "intent-match" };
    }
  }
  if (hasToken(["weather", "temperature", "rain", "forecast", "climate"])) {
    const weatherSkill = findSkill("weather_api");
    if (weatherSkill) {
      return { skill: weatherSkill, reason: "intent-match" };
    }
  }

  const best = ranked?.[0];
  const bestSkill = best?.skill;
  const bestScore = Number(best?.score || 0);

  if (bestSkill && bestScore >= MIN_SKILL_SCORE) {
    return { skill: bestSkill, reason: "best-match" };
  }

  const researchSkill = (Array.isArray(skills) ? skills : []).find(
    (s) => s?.id === GENERAL_FALLBACK_SKILL_ID
  );
  if (researchSkill) {
    return { skill: researchSkill, reason: "general-fallback" };
  }

  if (bestSkill) {
    return { skill: bestSkill, reason: "best-available" };
  }

  return null;
}

export default function AI({ agentId, credits, lastPseudonym, executeSkill, description }) {
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "AI interface ready. Every request is routed via backend AI skill router, then executed through marketplace skills.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const [skills, setSkills] = useState([]);
  const [topMatches, setTopMatches] = useState([]);

  useEffect(() => {
    const API_BASE = getApiBaseUrl();
    (async () => {
      const list = await fetchSkills(API_BASE);
      setSkills(Array.isArray(list) ? list : []);
    })();
  }, []);

  const addMessage = (role, content) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content }]);
  };

  const onSend = async (text) => {
    addMessage("user", text);
    const ranked = rankSkills(skills, text);
    setTopMatches(ranked.slice(0, 4));

    setSending(true);

    const backendSelection = await pickSkillViaBackendRouter(agentId, text, skills);
    const selection = backendSelection || pickSkillForExecution(ranked, skills, text);
    if (!selection?.skill) {
      addMessage("assistant", "No skills available to execute this request.");
      setSending(false);
      return;
    }

    const selected = selection.skill;
    if (Number(credits || 0) < Number(selected.cost || 0)) {
      addMessage(
        "assistant",
        `${selected.label} requires ${selected.cost} credits, but only ${credits} credits are available.`
      );
      setSending(false);
      return;
    }

    const result = await executeSkill(selected, { input: text }, selected.cost);
    if (!result.ok) {
      addMessage("assistant", `Skill execution failed: ${result.error}`);
      setSending(false);
      return;
    }

    const note =
      selection.reason === "backend-router"
        ? `(AI router: ${selection.routeReason || "backend"})`
        :
      selection.reason === "intent-match"
        ? "(intent keyword match)"
        :
      selection.reason === "general-fallback"
        ? "(general query → research skill fallback)"
        : selection.reason === "best-match"
        ? "(best capability match)"
        : "(fallback selection)";

    addMessage(
      "assistant",
      `Skill executed: ${selected.label} (${selected.id}) ${note}\nPseudonym: ${result.pseudonym}\nAnswer: ${formatSkillAnswer(
        selected.id,
        result.data
      )}`
    );

    setSending(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <AgentInfo
          agentId={agentId}
          credits={credits}
          lastPseudonym={lastPseudonym}
          description={description}
        />

        {topMatches?.length ? (
          <section className="rounded-xl border border-white/10 bg-[#111827]/80 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Skill Ranking</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              {topMatches.map(({ skill, score }) => (
                <li key={skill.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{skill.label}</span>
                  <span className="text-slate-500">
                    {skill.cost}cr · {score.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <ChatBox messages={messages} onSend={onSend} sending={sending} />
    </div>
  );
}
