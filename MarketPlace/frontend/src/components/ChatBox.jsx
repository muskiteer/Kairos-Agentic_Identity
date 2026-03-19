import { useState } from "react";
import ChatMessage from "./ChatMessage";

export default function ChatBox({ messages, onSend, sending }) {
  const [value, setValue] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || sending) return;
    setValue("");
    await onSend(text);
  };

  return (
    <section className="rounded-xl border border-white/15 bg-[rgba(17,24,39,0.72)] p-4 backdrop-blur-xl">
      <div className="mb-4 h-[460px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/60 p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} role={message.role} content={message.content} />
        ))}
        {sending && (
          <div className="text-xs text-slate-400">AI is processing...</div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Try: Get weather in Delhi"
          className="w-full rounded-lg border border-sky-400/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-sky-300 focus:shadow-[0_0_16px_rgba(56,189,248,0.35)]"
        />
        <button
          type="submit"
          disabled={sending || !value.trim()}
          className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 transition-all duration-200 hover:bg-emerald-500/30 hover:shadow-[0_0_16px_rgba(34,197,94,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}
