import React from "react";

export default function HelpPage() {
  return (
    <section className="page is-active help-page">
      <div className="help-wrap">
        <div className="help-hero card">
          <div className="help-hero-text">
            <h2>Documentation and User Guide</h2>
            <p className="muted">
              This interface provides access to the curated Drug-Target-Disease network atlas and
              its released analytical views.
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
          <h3>Recommended Workflow</h3>
          <div className="help-steps">
            <div className="help-step">
              <div className="step-num">1</div>
              <div className="step-body">
                <div className="step-title">Search & Center</div>
                <div className="muted">Use quick search or a node identifier to define the analysis center.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">2</div>
              <div className="step-body">
                <div className="step-title">Filter & Expand</div>
                <div className="muted">Adjust edge category, evidence type, and depth, then expand the selected node.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">3</div>
              <div className="step-body">
                <div className="step-title">Inspect Evidence</div>
                <div className="muted">Review evidence composition, chemical structure, SMILES, and target sequence.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">4</div>
              <div className="step-body">
                <div className="step-title">Export & Share</div>
                <div className="muted">Export the current subgraph and preserve the page state for downstream use.</div>
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
              <li>Specify a center node and load the corresponding subgraph</li>
              <li>Filter by edge category, evidence type, and graph depth</li>
              <li>Select nodes to inspect evidence, annotations, and neighborhood context</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Database Access</h3>
            <ul>
              <li>Review node and relationship tables with pagination support</li>
              <li>Use structured filters for atlas review and curation</li>
              <li>Open any node directly in the network analysis view</li>
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
            <h3>Release Access Notes</h3>
            <ul>
              <li>Use the atlas home page to enter the released network view</li>
              <li>Open database tables for sortable result records and algorithm evidence</li>
              <li>Export current views and result tables for downstream reporting</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
