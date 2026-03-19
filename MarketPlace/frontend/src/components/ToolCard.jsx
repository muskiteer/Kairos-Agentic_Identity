export default function ToolCard({ tool, onUse, disabled, loading, insufficient }) {
  return (
    <article className="group rounded-xl border border-white/10 bg-[rgba(17,24,39,0.7)] p-5 backdrop-blur-xl transition-transform duration-200 hover:scale-[1.02] hover:border-sky-400/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-100">{tool.label}</h3>
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
          {tool.cost} credits
        </span>
      </div>

      <p className="mb-5 text-sm text-slate-400">{tool.description}</p>

      <button
        type="button"
        onClick={() => onUse(tool)}
        disabled={disabled || loading}
        className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${
          insufficient
            ? "border-red-400/40 bg-red-500/15 text-red-200"
            : "border-emerald-400/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 hover:shadow-[0_0_16px_rgba(34,197,94,0.45)]"
        }`}
      >
        {loading ? "Processing..." : insufficient ? "Insufficient Credits" : "Use Tool"}
      </button>
    </article>
  );
}
