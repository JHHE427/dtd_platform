import React from "react";

const pagePrefetchers = {
  home: () => import("./HomePage"),
  analysis: () => import("./AnalysisPage"),
  database: () => import("./DatabasePage"),
  help: () => import("./HelpPage"),
};
const prefetched = new Set();
function prefetchPage(tab) {
  if (prefetched.has(tab)) return;
  const load = pagePrefetchers[tab];
  if (!load) return;
  prefetched.add(tab);
  load().catch(() => prefetched.delete(tab));
}

// Warm up heavy chunks during browser idle time so first-click into
// Analysis / Database is instant instead of waiting on a lazy import.
if (typeof window !== "undefined") {
  const warm = () => {
    prefetchPage("analysis");
    prefetchPage("database");
  };
  const ric = window.requestIdleCallback;
  if (ric) ric(warm, { timeout: 2500 });
  else setTimeout(warm, 1200);
}

export default function Header({ page, onPageChange, onQuickSearch, onSuggest }) {
  const [keyword, setKeyword] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const tabs = ["home", "analysis", "database", "help"];
  const boxRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const term = keyword.trim();
    if (!term) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const items = await onSuggest(term);
        if (!active) return;
        setSuggestions(items || []);
        setOpen(true);
      } catch {
        if (!active) return;
        setSuggestions([]);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [keyword, onSuggest]);

  React.useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "/") return;
      const tag = String(document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="header">
      <div className="header-inner">
        <button className="brand" onClick={() => onPageChange("home")}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" className="brand-logo" role="img" aria-label="DiseaseMind">
              <defs>
                <linearGradient id="dm-brain" x1="12" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#eff6ff" />
                  <stop offset="100%" stopColor="#ecfdf5" />
                </linearGradient>
              </defs>
              <path d="M13 30C7.8 21.8 15.1 10.5 26 12.3C32.8 7.1 44 9.1 48.2 18.4C56.9 20.1 61.2 30.1 56.8 38.5C59.8 47 52.4 54 43.8 52.6C38 57.3 28.3 55.6 24 49.5C15.7 49.5 10.2 42 12.4 34.6Z" fill="url(#dm-brain)" stroke="#8ec5ff" strokeWidth="2" strokeLinejoin="round" />
              <path d="M34.6 33L20.6 24.6M34.6 33L46.4 22M34.6 33L49.4 34.6M34.6 33L43 47M34.6 33L24.2 45.8M34.6 33L18.6 37" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" opacity="0.66" />
              <path d="M20.6 24.6L46.4 22M49.4 34.6L43 47M24.2 45.8L18.6 37" fill="none" stroke="#14b8a6" strokeWidth="1.1" strokeLinecap="round" opacity="0.36" />
              <circle cx="20.6" cy="24.6" r="3.5" fill="#3b82f6" />
              <circle cx="46.4" cy="22" r="3.5" fill="#f59e0b" />
              <circle cx="49.4" cy="34.6" r="3.5" fill="#3b82f6" />
              <circle cx="43" cy="47" r="3.5" fill="#f59e0b" />
              <circle cx="24.2" cy="45.8" r="3.5" fill="#3b82f6" />
              <circle cx="18.6" cy="37" r="3.5" fill="#f59e0b" />
              <circle cx="34.6" cy="33" r="7" fill="#ef4444" />
              <circle cx="34.6" cy="33" r="4.3" fill="#fca5a5" />
              <circle cx="34.6" cy="33" r="2" fill="#dc2626" />
            </svg>
          </span>
          <span className="brand-text">
            <strong>DiseaseMind</strong>
            <span>Drug · Target · Disease · Mind</span>
            <em>Disease-centered AI system</em>
          </span>
        </button>

        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`nav-btn ${page === tab ? "is-active" : ""}`}
              onClick={() => onPageChange(tab)}
              onMouseEnter={() => prefetchPage(tab)}
              onFocus={() => prefetchPage(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <span className="system-status" title="Live Data Source">
            <span className="system-status__dot" aria-hidden="true" />
            Live Data Source
          </span>
        </nav>

        <div className="quick-search" ref={boxRef}>
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOpen(false);
                onQuickSearch(keyword);
              }
            }}
            placeholder="Search a drug, target, disease, ncRNA, or registered alias..."
          />
          <button onClick={() => onQuickSearch(keyword)}>Go</button>
          {open && suggestions.length > 0 ? (
            <div className="suggest-panel">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="suggest-item"
                  onClick={() => {
                    setKeyword(s.display_name || s.label);
                    setOpen(false);
                    onQuickSearch(s.id);
                  }}
                >
                  <span className="s-title">{s.display_name || s.label}</span>
                  <span className="s-meta">{s.node_type} · {s.id}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
