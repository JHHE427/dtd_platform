import React from "react";

export default function HelpPage() {
  return (
    <section className="page is-active help-page">
      <div className="help-wrap">
        <div className="help-hero card">
          <div className="help-hero-text">
            <h2>Documentation & User Guide</h2>
            <p className="muted">
              This React frontend is directly connected to your production SQLite graph database through
              FastAPI endpoints.
            </p>
            <div className="help-badges">
              <span className="chip">Drug</span>
              <span className="chip">Target</span>
              <span className="chip">Disease</span>
              <span className="chip">Known/Predicted</span>
            </div>
          </div>
          <div className="help-hero-graphic" aria-hidden="true">
            <svg viewBox="0 0 560 260" className="help-svg">
              <defs>
                <linearGradient id="helpBg" x1="0" x2="1">
                  <stop offset="0%" stopColor="#eff6ff" />
                  <stop offset="100%" stopColor="#f0fdfa" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="560" height="260" fill="url(#helpBg)" rx="18" />
              <circle cx="100" cy="120" r="20" fill="#ef4444" />
              <circle cx="245" cy="70" r="16" fill="#f59e0b" />
              <circle cx="245" cy="168" r="16" fill="#f59e0b" />
              <circle cx="400" cy="120" r="17" fill="#3b82f6" />
              <line x1="116" y1="116" x2="226" y2="76" stroke="#2563eb" strokeWidth="3" />
              <line x1="116" y1="124" x2="226" y2="160" stroke="#fb923c" strokeWidth="3" strokeDasharray="6 4" />
              <line x1="262" y1="70" x2="382" y2="116" stroke="#8b5cf6" strokeWidth="3" />
              <line x1="262" y1="168" x2="382" y2="124" stroke="#2563eb" strokeWidth="3" />
              <text x="72" y="156" fill="#334155" fontSize="14" fontWeight="700">Disease</text>
              <text x="214" y="42" fill="#334155" fontSize="14" fontWeight="700">Target</text>
              <text x="214" y="198" fill="#334155" fontSize="14" fontWeight="700">Target</text>
              <text x="372" y="156" fill="#334155" fontSize="14" fontWeight="700">Drug</text>
            </svg>
          </div>
        </div>

        <div className="help-flow card panel-pad">
          <h3>How To Use This Platform</h3>
          <div className="help-steps">
            <div className="help-step">
              <div className="step-num">1</div>
              <div className="step-body">
                <div className="step-title">Search & Center</div>
                <div className="muted">Use quick search or node ID to set graph center.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">2</div>
              <div className="step-body">
                <div className="step-title">Filter & Expand</div>
                <div className="muted">Adjust category/type/depth and expand selected nodes.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">3</div>
              <div className="step-body">
                <div className="step-title">Inspect Evidence</div>
                <div className="muted">Review score composition, structure, SMILES and sequence.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">4</div>
              <div className="step-body">
                <div className="step-title">Export & Share</div>
                <div className="muted">Export subgraph CSV and share URL state with collaborators.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="help-grid">
          <article className="card panel-pad">
            <h3>Network Semantics</h3>
            <ul>
              <li>Node groups: Drug, Target, Disease</li>
              <li>Edge types: Known, Predicted, Known+Predicted</li>
              <li>Disease IDs are normalized as `DIS::...`</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Analysis Workflow</h3>
            <ul>
              <li>Select center node and load subgraph</li>
              <li>Filter by edge category/type and adjust depth</li>
              <li>Click nodes to inspect evidence and neighbors</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Database Browser</h3>
            <ul>
              <li>Browse all nodes and edges with pagination</li>
              <li>Use filters for QA and curation checks</li>
              <li>Jump any node directly into analysis view</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Visual Legend</h3>
            <ul>
              <li>Node color: Drug=blue, Target=orange, Disease=red</li>
              <li>Edge style: Known=solid, Predicted=dashed, Known+Predicted=hybrid</li>
              <li>Node ring segments represent evidence composition</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Interaction Shortcuts</h3>
            <ul>
              <li>Wheel: zoom in/out</li>
              <li>Drag blank area: pan graph</li>
              <li>Double click node: expand one-hop neighbors</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Deployment Reminder</h3>
            <ul>
              <li>Build frontend: <code>npm run build</code></li>
              <li>Start backend: <code>uvicorn app:app --host 0.0.0.0 --port 8787</code></li>
              <li>Serve <code>/static</code> in production with reverse proxy</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
