import { useEffect, useState } from "react";
import AgentInfo from "../components/AgentInfo";
import ChatBox from "../components/ChatBox";
import { fetchSkills, rankSkills } from "../lib/skills";

export default function AI({ agentId, credits, lastPseudonym, executeSkill, description }) {
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "AI interface ready. Describe what you want (weather, crypto, QR, research, etc.) and I will route to the best skill based on capability match, trust, cost, and SLA.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const [skills, setSkills] = useState([]);
  const [topMatches, setTopMatches] = useState([]);

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
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
    const best = ranked?.[0]?.skill;

    if (!best) {
      addMessage("assistant", "No skills available right now. Try Marketplace first.");
      return;
    }

    setTopMatches(ranked.slice(0, 4));

    setSending(true);

    if (credits < best.cost) {
      setSending(false);
      addMessage("assistant", `Insufficient credits. ${best.label} costs ${best.cost} credits.`);
      return;
    }

    const result = await executeSkill(best, { input: text }, best.cost);

    if (!result.ok) {
      addMessage("assistant", `Request failed: ${result.error}`);
      setSending(false);
      return;
    }

    addMessage(
      "assistant",
      `Skill: ${best.label} (${best.id})\nPseudonym: ${result.pseudonym}\nResponse: ${JSON.stringify(
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
