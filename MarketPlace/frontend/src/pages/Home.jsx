import { useState } from "react";
import AgentInfo from "../components/AgentInfo";

export default function Home({
  agentId,
  credits,
  lastPseudonym,
  createAgent,
  loadAgent,
  agentDescription,
  setAgentDescription,
}) {
  const [existingId, setExistingId] = useState("");

  const submitLoad = (event) => {
    event.preventDefault();
    if (!existingId.trim()) return;
    loadAgent(existingId);
    setExistingId("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-white/10 bg-[#111827]/80 p-8 backdrop-blur-xl">
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-sky-300">Neural Identity Layer</p>
        <h2 className="text-4xl font-bold text-slate-100">Agentic Identity Marketplace</h2>
        <p className="mt-4 text-slate-400">
          Autonomous Agents. Secure Identity. Decentralized Intelligence.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={createAgent}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-5 py-3 text-sm font-medium text-emerald-200 transition-all duration-200 hover:scale-105 hover:bg-emerald-500/35 hover:shadow-[0_0_18px_rgba(34,197,94,0.45)]"
          >
            Create Agent
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs text-slate-400">Agent Description</p>
          <textarea
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
            placeholder="e.g., Weather analyst agent with reliable forecasts (demo)"
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#38bdf8]"
          />
        </div>

        <form onSubmit={submitLoad} className="mt-4 flex gap-2">
          <input
            value={existingId}
            onChange={(event) => setExistingId(event.target.value)}
            placeholder="Paste existing agent ID"
            className="w-full rounded-lg border border-sky-400/30 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300"
          />
          <button
            type="submit"
            className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm text-sky-200 transition-all duration-200 hover:scale-105 hover:bg-sky-500/30 hover:shadow-[0_0_18px_rgba(56,189,248,0.4)]"
          >
            Load Existing Agent
          </button>
        </form>

        <div className="mt-8 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
          <p className="text-xs text-violet-300">Current Agent ID</p>
          <p className="mt-1 break-all text-sm text-violet-100">{agentId || "No active agent"}</p>
        </div>
      </section>

      <AgentInfo
        agentId={agentId}
        credits={credits}
        lastPseudonym={lastPseudonym}
        description={agentDescription}
      />
    </div>
  );
}
