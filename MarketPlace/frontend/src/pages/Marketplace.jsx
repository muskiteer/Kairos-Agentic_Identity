import { useEffect, useMemo, useState } from "react";
import ToolCard from "../components/ToolCard";
import AgentInfo from "../components/AgentInfo";
import { fetchSkills } from "../lib/skills";
import { getApiBaseUrl } from "../lib/api";

export default function Marketplace({
  agentId,
  credits,
  lastPseudonym,
  description,
  executeSkill,
}) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSkillId, setActiveSkillId] = useState("");
  const [output, setOutput] = useState("Use a tool to see API output.");

  useEffect(() => {
    const API_BASE = getApiBaseUrl();
    (async () => {
      const list = await fetchSkills(API_BASE);
      setSkills(Array.isArray(list) ? list : []);
    })();
  }, []);

  const sortedSkills = useMemo(() => {
    const arr = Array.isArray(skills) ? skills.slice() : [];
    arr.sort((a, b) => {
      const ra = Number(a?.manifest?.reputation ?? 0.5);
      const rb = Number(b?.manifest?.reputation ?? 0.5);
      const ca = Number(a?.cost ?? 1);
      const cb = Number(b?.cost ?? 1);
      // Prefer higher reputation, then lower cost.
      return rb - ra || ca - cb;
    });
    return arr;
  }, [skills]);

  const handleUseSkill = async (skill) => {
    setLoading(true);
    setActiveSkillId(skill.id);

    const result = await executeSkill(
      skill,
      { input: `Use ${skill.label}` },
      skill.cost
    );

    if (!result.ok) {
      setOutput(`❌ ${result.error}`);
      setLoading(false);
      return;
    }

    setOutput(JSON.stringify(result.data, null, 2));
    setLoading(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <AgentInfo agentId={agentId} credits={credits} lastPseudonym={lastPseudonym} description={description} />
        <div className="rounded-xl border border-white/10 bg-[#111827]/80 p-4 backdrop-blur-xl">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Last Output</h3>
          <pre className="max-h-[340px] overflow-auto rounded-lg border border-white/10 bg-[#0b1222]/80 p-3 text-xs text-slate-300">
            {output}
          </pre>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedSkills.map((skill) => (
          <ToolCard
            key={skill.id}
            tool={skill}
            onUse={handleUseSkill}
            loading={loading && activeSkillId === skill.id}
            disabled={credits < skill.cost}
            insufficient={credits < skill.cost}
          />
        ))}
      </div>
    </div>
  );
}
