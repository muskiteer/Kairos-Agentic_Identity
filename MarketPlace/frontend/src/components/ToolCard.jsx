export default function ToolCard({ tool, onUse, disabled, loading, insufficient }) {
  const manifest = tool?.manifest || {};
  const trust = manifest.reputation;
  const latencyMs = manifest.latencyMs;
  const version = manifest.version;

  return (
    <article className="group rounded-xl border border-white/10 bg-[#111827] p-5 shadow-sm transition-transform duration-200 hover:scale-[1.01] hover:border-[#38bdf8]/30">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-100">{tool.label}</h3>
        <span className="rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-2 py-1 text-xs text-[#22c55e]">
          {tool.cost ?? 1} credits
        </span>
      </div>

      <p className="mb-5 text-sm text-slate-400">{tool.description || "No description available."}</p>

      <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
        {typeof trust === "number" && (
          <span className="rounded-full border border-[#22c55e]/25 bg-[#22c55e]/5 px-2 py-1 text-[#22c55e]">
            Trust {trust.toFixed(2)}
          </span>
        )}
        {typeof latencyMs === "number" && (
          <span className="rounded-full border border-[#38bdf8]/25 bg-[#38bdf8]/5 px-2 py-1 text-[#38bdf8]">
            SLA {Math.round(latencyMs)}ms
          </span>
        )}
        {version && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
            v{version}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onUse(tool)}
        disabled={disabled || loading}
        className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${
          insufficient
            ? "border-[#ef4444]/40 bg-[#ef4444]/15 text-[#ef4444]"
            : "border-[#22c55e]/40 bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/30 hover:shadow-[0_0_16px_rgba(34,197,94,0.35)]"
        }`}
      >
        {loading ? "Processing..." : insufficient ? "Insufficient Credits" : "Use Skill"}
      </button>
    </article>
  );
}
