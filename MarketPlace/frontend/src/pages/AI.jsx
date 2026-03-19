import { useState } from "react";
import AgentInfo from "../components/AgentInfo";
import ChatBox from "../components/ChatBox";

function detectIntent(text) {
  const q = text.toLowerCase();

  if (q.includes("weather") || q.includes("temperature") || q.includes("climate")) {
    return { tool: "weather_api", cost: 1 };
  }
  if (q.includes("btc") || q.includes("crypto") || q.includes("eth") || q.includes("price")) {
    return { tool: "crypto_api", cost: 1 };
  }
  if (q.includes("qr") || q.includes("qrcode")) {
    return { tool: "qr_api", cost: 2 };
  }
  if (q.includes("research") || q.includes("search")) {
    return { tool: "research_api", cost: 3 };
  }

  return null;
}

export default function AI({ agentId, credits, lastPseudonym, executeTool }) {
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "AI terminal online. Try: Get weather in Delhi, Get BTC price, or Generate QR for hello.",
    },
  ]);
  const [sending, setSending] = useState(false);

  const addMessage = (role, content) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content }]);
  };

  const onSend = async (text) => {
    addMessage("user", text);
    const intent = detectIntent(text);

    if (!intent) {
      addMessage("assistant", "I could not map that intent. Try weather, crypto, qr, or research.");
      return;
    }

    setSending(true);

    const result = await executeTool(intent.tool, { input: text }, intent.cost);

    if (!result.ok) {
      addMessage("assistant", `Request failed: ${result.error}`);
      setSending(false);
      return;
    }

    addMessage(
      "assistant",
      `Tool: ${intent.tool}\nPseudonym: ${result.pseudonym}\nResponse: ${JSON.stringify(result.data)}`
    );

    setSending(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <AgentInfo agentId={agentId} credits={credits} lastPseudonym={lastPseudonym} />

        <section className="rounded-xl border border-white/10 bg-[rgba(17,24,39,0.7)] p-4 backdrop-blur-xl">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Intent Routing</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><span className="text-emerald-300">weather</span> → /tools/weather_api (1)</li>
            <li><span className="text-sky-300">crypto</span> → /tools/crypto_api (1)</li>
            <li><span className="text-violet-300">qr</span> → /tools/qr_api (2)</li>
            <li><span className="text-amber-300">research</span> → /tools/research_api (3)</li>
          </ul>
        </section>
      </div>

      <ChatBox messages={messages} onSend={onSend} sending={sending} />
    </div>
  );
}
