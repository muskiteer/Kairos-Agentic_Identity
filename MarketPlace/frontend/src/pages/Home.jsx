import { useRef, useState } from "react";
import AgentInfo from "../components/AgentInfo";

export default function Home({
  agentId,
  credits,
  lastPseudonym,
  createAgent,
  loadAgent,
  exportAgentBackup,
  importAgentBackup,
  agentDescription,
  setAgentDescription,
  registerAgentSkills,
}) {
  const [existingId, setExistingId] = useState("");
  const [skillsText, setSkillsText] = useState("weather_api,crypto_api");
  const [skillsPrice, setSkillsPrice] = useState(1);
  const [skillsStatus, setSkillsStatus] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const backupInputRef = useRef(null);

  const submitLoad = (event) => {
    event.preventDefault();
    if (!existingId.trim()) return;
    loadAgent(existingId);
    setExistingId("");
  };

  const submitRegisterSkills = async (event) => {
    event.preventDefault();
    setSkillsStatus("Registering...");
    const result = await registerAgentSkills({
      skillsText,
      price: Number(skillsPrice),
    });
    if (!result.ok) {
      setSkillsStatus(`❌ ${result.error}`);
      return;
    }
    setSkillsStatus(`✅ Skills registered for ${result.data?.agent_id || agentId}`);
  };

  const onDownloadBackup = () => {
    setBackupStatus("");
    const result = exportAgentBackup();
    if (!result?.ok) {
      setBackupStatus(`❌ ${result?.error || "Failed to export backup."}`);
      return;
    }
    setBackupStatus("✅ Downloaded agent backup JSON.");
  };

  const onPickBackupFile = () => {
    backupInputRef.current?.click();
  };

  const onImportBackupFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBackupStatus("Importing backup...");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importAgentBackup(parsed);
      if (!result?.ok) {
        setBackupStatus(`❌ ${result?.error || "Failed to import backup."}`);
        return;
      }
      setBackupStatus("✅ Agent backup imported. Agent loaded successfully.");
    } catch {
      setBackupStatus("❌ Invalid JSON backup file.");
    } finally {
      event.target.value = "";
    }
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

        <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/50 p-3">
          <p className="mb-2 text-xs text-slate-400">Agent Backup (JSON)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownloadBackup}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-200 transition-all duration-200 hover:bg-emerald-500/30"
            >
              Download Agent JSON
            </button>
            <button
              type="button"
              onClick={onPickBackupFile}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-xs text-sky-200 transition-all duration-200 hover:bg-sky-500/30"
            >
              Import Agent JSON
            </button>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportBackupFile}
            />
          </div>
          {backupStatus ? <p className="mt-2 text-xs text-slate-300">{backupStatus}</p> : null}
        </div>

        <form onSubmit={submitRegisterSkills} className="mt-5 rounded-lg border border-white/10 bg-slate-900/50 p-3">
          <p className="mb-2 text-xs text-slate-400">Monetize Agent (earn credits by offering skills)</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-1 text-[11px] text-slate-500">Skill IDs (comma separated)</p>
              <input
                value={skillsText}
                onChange={(event) => setSkillsText(event.target.value)}
                placeholder="e.g. market_research_api,competitor_scan_api"
                className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#38bdf8]"
              />
            </div>

            <div>
              <p className="mb-1 text-[11px] text-slate-500">Price (credits/request)</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSkillsPrice((prev) => Math.max(1, Number(prev || 1) - 1))}
                  className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:border-sky-400/40"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={skillsPrice}
                  onChange={(event) => setSkillsPrice(event.target.value)}
                  className="w-24 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-center text-sm text-slate-100 outline-none focus:border-[#38bdf8]"
                />
                <button
                  type="button"
                  onClick={() => setSkillsPrice((prev) => Number(prev || 0) + 1)}
                  className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:border-sky-400/40"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="rounded-lg border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm text-violet-200 transition-all duration-200 hover:bg-violet-500/30"
            >
              Publish Agent Offer
            </button>
          </div>

          {skillsStatus ? <p className="mt-2 text-xs text-slate-300">{skillsStatus}</p> : null}
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
