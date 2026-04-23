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
            <svg viewBox="0 0 64 64" className="brand-logo" role="img">
              <defs>
                <linearGradient id="atlas-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8ec5ff" />
                  <stop offset="100%" stopColor="#49d4c4" />
                </linearGradient>
                <radialGradient id="atlas-core" cx="50%" cy="42%" r="58%">
                  <stop offset="0%" stopColor="#ff8c82" />
                  <stop offset="100%" stopColor="#ef4444" />
                </radialGradient>
                <linearGradient id="atlas-link" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#cfe5ff" />
                  <stop offset="100%" stopColor="#8bd6ce" />
                </linearGradient>
                <filter id="atlas-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="32" cy="32" r="24" fill="none" stroke="url(#atlas-ring)" strokeWidth="2.5" />
              <circle cx="32" cy="32" r="19.2" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="1.3" />
              <path d="M16.5 41.5C23 32.5 28.8 29 32 32.2C35.7 35.6 41.1 30 47.6 22.8" fill="none" stroke="url(#atlas-link)" strokeWidth="2.7" strokeLinecap="round" />
              <path d="M18 20.8C23.8 18.6 28.2 19.2 33 23.3C37.8 27.2 42.2 26.6 49 23" fill="none" stroke="rgba(20,184,166,0.86)" strokeWidth="2" strokeLinecap="round" />
              <path d="M18.8 47C24.5 40.2 30.2 35 36.6 36.3C41.4 37.2 44.8 41 48 46" fill="none" stroke="rgba(148,163,184,0.72)" strokeWidth="2.1" strokeLinecap="round" />
              <circle cx="32" cy="32" r="8.2" fill="url(#atlas-core)" filter="url(#atlas-glow)" />
              <circle cx="32" cy="32" r="12.6" fill="none" stroke="rgba(239,68,68,0.24)" strokeWidth="2.6" />
              <circle cx="17.8" cy="41.8" r="5" fill="#2f7fff" />
              <circle cx="47.4" cy="22.8" r="4.7" fill="#2dd4bf" />
              <circle cx="48" cy="46.2" r="5" fill="#fbbf24" />
              <circle cx="19.2" cy="21" r="3.8" fill="#818cf8" />
              <circle cx="27.8" cy="16.8" r="1.6" fill="rgba(255,255,255,0.82)" />
            </svg>
          </span>
          <span className="brand-text">
            <strong>Disease Network</strong>
            <span>Atlas</span>
            <em>Drug · Target · ncRNA</em>
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
