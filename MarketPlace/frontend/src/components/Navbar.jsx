import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/visualize", label: "Visualize" },
  { to: "/ai", label: "AI Interface" },
  { to: "/developer", label: "Developer" },
];

export default function Navbar({ credits }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-200">
            Agentic Identity Marketplace
          </h1>
        </div>

        <ul className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-xs transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_rgba(34,197,94,0.35)]"
                      : "text-slate-300 hover:bg-sky-400/10 hover:text-sky-200"
                  }`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 shadow-[0_0_14px_rgba(34,197,94,0.35)]">
          Credits: {credits}
        </div>
      </nav>
    </header>
  );
}
