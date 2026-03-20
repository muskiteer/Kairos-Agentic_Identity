export default function ChatMessage({ role, content }) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-[0_0_16px_rgba(34,197,94,0.25)]"
            : "border-sky-400/40 bg-sky-500/10 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.25)]"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
