import React from "react";

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
                <linearGradient id="dna-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="24" fill="none" stroke="url(#dna-ring)" strokeWidth="2.4" />
              <path d="M17 39 Q25 28 32 32 T47 25" fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M19 47 Q31 29 45 45" fill="none" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M18 23 Q28 18 39 17 T50 23" fill="none" stroke="#14b8a6" strokeWidth="1.9" strokeLinecap="round" opacity="0.95" />
              <circle cx="32" cy="32" r="7.2" fill="#ef4444" />
              <circle cx="32" cy="32" r="11.4" fill="none" stroke="rgba(239,68,68,0.28)" strokeWidth="2.4" />
              <circle cx="18.5" cy="39.5" r="4.8" fill="#2563eb" />
              <circle cx="46" cy="25.5" r="4.6" fill="#14b8a6" />
              <circle cx="45.5" cy="45.5" r="4.9" fill="#f59e0b" />
              <circle cx="22" cy="20.5" r="3.6" fill="#6366f1" />
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
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
