import { useEffect, useMemo, useState } from "react";
import AgentInfo from "../components/AgentInfo";
import { getApiBaseUrl } from "../lib/api";

const API_BASE = getApiBaseUrl();

function StatCard({ title, value, hint }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#111827]/80 p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </article>
  );
}

export default function DeveloperDashboard({ agentId, credits, lastPseudonym, description }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const loadDashboard = async () => {
    if (!agentId) {
      setData(null);
      setError("Load or create an agent first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/agent/developer/dashboard?agent_id=${encodeURIComponent(agentId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `Request failed (${res.status})`);
        setData(null);
        setLoading(false);
        return;
      }
      setData(json);
    } catch {
      setError("Network error while loading dashboard.");
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const stats = useMemo(() => {
    if (!data) return null;
    const payment = data.payment || {};
    const trust = data.trust || {};
    const cost = data.cost || {};

    return {
      earned: Number(payment.earned || 0),
      spent: Number(payment.spent || 0),
      net: Number(payment.net || 0),
      txCount: Number(payment.total_transactions || 0),
      avgTx: Number(payment.average_tx_amount || 0),
      trustScore: Number(trust.trust_score || 0),
      avgRep: Number(trust.avg_reputation || 0),
      avgAvail: Number(trust.avg_availability || 0),
      successExec: Number(trust.successful_executions || 0),
      rejectedExec: Number(trust.rejected_executions || 0),
      skillsCount: Number(cost.skills_count || 0),
      minPrice: Number(cost.min_price || 0),
      maxPrice: Number(cost.max_price || 0),
      avgPrice: Number(cost.avg_price || 0),
    };
  }, [data]);

  const readiness = data?.prototype_readiness || {};
  const skills = Array.isArray(data?.skills) ? data.skills : [];
  const txs = Array.isArray(data?.recent_transactions) ? data.recent_transactions : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <AgentInfo
          agentId={agentId}
          credits={credits}
          lastPseudonym={lastPseudonym}
          description={description}
        />

        <section className="rounded-xl border border-white/10 bg-[#111827]/80 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Developer Dashboard</h2>
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading || !agentId}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Payment, trust, and cost analytics for the active provider/user agent.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-300">{error}</p>
          ) : null}
        </section>
      </div>

      {stats ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Earned" value={`${stats.earned} cr`} hint={`Spent ${stats.spent} cr`} />
            <StatCard title="Net" value={`${stats.net} cr`} hint={`Avg Tx ${stats.avgTx.toFixed(2)} cr`} />
            <StatCard title="Trust Score" value={stats.trustScore.toFixed(2)} hint={`Rep ${stats.avgRep.toFixed(2)} · Avail ${stats.avgAvail.toFixed(2)}`} />
            <StatCard title="Skills" value={stats.skillsCount} hint={`Price ${stats.minPrice}-${stats.maxPrice} cr`} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-white/10 bg-[#111827]/80 p-5 backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-slate-100">Recent Transactions</h3>
              <div className="mt-3 max-h-[320px] overflow-auto rounded-lg border border-white/10 bg-[#0b1222]/70">
                {txs.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400">No transactions yet.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Txn</th>
                        <th className="px-3 py-2">Skill</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((tx) => (
                        <tr key={tx.transaction_id} className="border-b border-white/5 text-slate-200">
                          <td className="px-3 py-2">{tx.transaction_id?.slice(0, 14)}...</td>
                          <td className="px-3 py-2">{tx.skill || "-"}</td>
                          <td className="px-3 py-2">{tx.amount} cr</td>
                          <td className="px-3 py-2">{tx.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>

            <article className="rounded-xl border border-white/10 bg-[#111827]/80 p-5 backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-slate-100">Published Skills</h3>
              <div className="mt-3 space-y-2">
                {skills.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-[#0b1222]/70 p-3 text-xs text-slate-400">
                    No skills published via skill manifests yet.
                  </p>
                ) : (
                  skills.map((s) => (
                    <div key={s.skill_id} className="rounded-lg border border-white/10 bg-[#0b1222]/70 p-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{s.skill_id}</span>
                        <span>{s.price} cr</span>
                      </div>
                      <p className="mt-1 text-slate-400">Trust {Number(s.reputation || 0).toFixed(2)} · Avail {Number(s.availability || 0).toFixed(2)} · SLA {s.latency_ms}ms</p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#111827]/80 p-5 backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-slate-100">Prototype Readiness</h3>
            <ul className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
              <li>Identity registered: {String(!!readiness.identity_registered)}</li>
              <li>Skills published: {String(!!readiness.has_skills_published)}</li>
              <li>Transaction history: {String(!!readiness.has_tx_history)}</li>
              <li>Trust scoring available: {String(!!readiness.trust_scoring_available)}</li>
            </ul>
            {readiness.recommendation ? (
              <p className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-200">
                Next: {readiness.recommendation}
              </p>
            ) : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total Transactions" value={stats.txCount} hint="Incoming + outgoing" />
            <StatCard title="Successful Executions" value={stats.successExec} hint={`Rejected ${stats.rejectedExec}`} />
            <StatCard title="Average Price" value={`${stats.avgPrice.toFixed(2)} cr`} hint="Across published skills" />
          </section>
        </>
      ) : null}
    </div>
  );
}
