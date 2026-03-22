export function getApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;

  if (typeof window === "undefined") return "";

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  // Local DX: connect directly to Go backend even when no env var is set.
  if (isLocal && port !== "8080") {
    return `${protocol}//${hostname}:8080`;
  }

  // Default deployed backend URL.
  return "https://kairos-agentic-identity.onrender.com";
}
