import { useEffect, useMemo, useState } from "react";
import ToolCard from "../components/ToolCard";
import AgentInfo from "../components/AgentInfo";

const COSTS = {
  weather_api: 1,
  crypto_api: 1,
  research_api: 3,
  qr_api: 2,
  crypto_price: 1,
  qr_generate: 2,
};

const FALLBACK_TOOLS = [
  { name: "weather_api", description: "Get weather insights for cities." },
  { name: "crypto_api", description: "Get latest BTC/ETH prices." },
  { name: "qr_api", description: "Generate QR from text or URL." },
  { name: "research_api", description: "Research and summarize a topic." },
];

const prettify = (name) =>
  name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function Marketplace({
  agentId,
  credits,
  lastPseudonym,
  executeTool,
}) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState("");
  const [output, setOutput] = useState("Use a tool to see API output.");

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/tools`);
        if (!response.ok) throw new Error("Failed to fetch tools");
        const data = await response.json();
        setTools(Array.isArray(data) && data.length ? data : FALLBACK_TOOLS);
      } catch {
        setTools(FALLBACK_TOOLS);
      }
    })();
  }, []);

  const normalizedTools = useMemo(
    () =>
      tools.map((tool) => {
        const rawName = tool.name || tool.id || "tool";
        const id = rawName;
        return {
          id,
          label: prettify(rawName),
          description: tool.description || "No description available.",
          cost: COSTS[id] ?? 1,
        };
      }),
    [tools]
  );

  const handleUseTool = async (tool) => {
    setLoading(true);
    setActiveTool(tool.id);

    const result = await executeTool(tool.id, { input: `Use ${tool.label}` }, tool.cost);

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
        <AgentInfo agentId={agentId} credits={credits} lastPseudonym={lastPseudonym} />
        <div className="rounded-xl border border-white/10 bg-[rgba(17,24,39,0.72)] p-4 backdrop-blur-xl">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Last Output</h3>
          <pre className="max-h-[340px] overflow-auto rounded-lg border border-white/10 bg-slate-900/80 p-3 text-xs text-slate-300">
            {output}
          </pre>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {normalizedTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onUse={handleUseTool}
            loading={loading && activeTool === tool.id}
            disabled={credits < tool.cost}
            insufficient={credits < tool.cost}
          />
        ))}
      </div>
    </div>
  );
}
