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
              <circle cx="32" cy="32" r="25" fill="none" stroke="#93c5fd" strokeWidth="2.2" />
              <path
                d="M19 43 L32 21 L45 43 Z"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <circle cx="32" cy="21" r="5.4" fill="#3b82f6" />
              <circle cx="19" cy="43" r="5.4" fill="#f59e0b" />
              <circle cx="45" cy="43" r="5.4" fill="#ef4444" />
              <circle cx="50.5" cy="16.5" r="3.2" fill="#14b8a6" />
              <path
                d="M47.2 18.8 Q40 27 34.5 33.5"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="brand-text">
            DTD<span>Atlas</span>
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
            placeholder="Search a drug, target, disease, or registered alias..."
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
