import AgentInfo from "../components/AgentInfo";

export default function Visualize({
  agentId,
  credits,
  lastPseudonym,
  description,
  pseudonymsByService,
}) {
  const services = Object.entries(pseudonymsByService);

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
          <h2 className="text-lg font-semibold text-slate-100">Identity Graph View</h2>
          <p className="mt-2 text-sm text-slate-400">
            Agent identity stays stable while pseudonyms rotate per tool/service.
          </p>

          <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-500/5 p-4">
            <p className="text-xs text-sky-300">Root Identity</p>
            <p className="mt-1 break-all text-sm text-sky-100">{agentId || "No active agent"}</p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#111827]/80 p-5 backdrop-blur-xl">
        <h3 className="mb-4 text-sm font-semibold text-slate-100">Pseudonyms Per Service</h3>

        {!services.length ? (
          <p className="rounded-lg border border-violet-400/20 bg-violet-500/5 p-4 text-sm text-violet-200">
            No pseudonyms generated yet. Use skills in Marketplace or AI Interface.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {services.map(([service, pseudonyms]) => (
              <article
                key={service}
                className="rounded-xl border border-violet-400/25 bg-violet-500/5 p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_0_18px_rgba(167,139,250,0.25)]"
              >
                <h4 className="mb-3 text-sm font-semibold text-violet-200">{service}</h4>
                <ul className="space-y-2">
                  {pseudonyms.map((pseudo) => (
                    <li
                      key={pseudo}
                      className="rounded-md border border-white/10 bg-slate-900/70 p-2 text-xs text-slate-300"
                    >
                      {pseudo}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
