export default function AgentInfo({ agentId, credits, lastPseudonym }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[rgba(17,24,39,0.7)] p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Agent Status</h3>
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            credits > 0
              ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
              : "border border-red-400/50 bg-red-500/20 text-red-300"
          }`}
        >
          {credits} credits
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <p className="text-slate-400">Agent ID</p>
        <p className="break-all rounded-lg border border-sky-400/20 bg-sky-400/5 p-2 text-sky-200">
          {agentId || "No agent loaded"}
        </p>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p className="text-slate-400">Last Pseudonym</p>
        <p className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-2 text-violet-200">
          {lastPseudonym || "None yet"}
        </p>
      </div>
    </section>
  );
}
