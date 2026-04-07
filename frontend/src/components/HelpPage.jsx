import React from "react";

export default function HelpPage() {
  return (
    <section className="page is-active help-page">
      <div className="help-wrap">
        <div className="help-hero card">
        <div className="help-hero-text">
            <h2>Disease Network Atlas Documentation</h2>
            <p className="muted">
              This guide describes the released disease-centered drug, target, disease, and ncRNA
              network atlas, its structured result tables, and the supported network-analysis workflow.
            </p>
            <div className="help-badges">
              <span className="chip">Drug</span>
              <span className="chip">Target</span>
              <span className="chip">Disease</span>
              <span className="chip">ncRNA</span>
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
              <circle cx="100" cy="120" r="30" fill="none" stroke="rgba(239,68,68,0.28)" strokeWidth="5" />
              <circle cx="245" cy="70" r="16" fill="#f59e0b" />
              <circle cx="245" cy="168" r="16" fill="#f59e0b" />
              <circle cx="400" cy="120" r="17" fill="#3b82f6" />
              <circle cx="400" cy="190" r="17" fill="#14b8a6" />
              <line x1="116" y1="116" x2="226" y2="76" stroke="#2563eb" strokeWidth="3" />
              <line x1="116" y1="124" x2="226" y2="160" stroke="#fb923c" strokeWidth="3" strokeDasharray="6 4" />
              <line x1="262" y1="70" x2="382" y2="116" stroke="#8b5cf6" strokeWidth="3" />
              <line x1="262" y1="168" x2="382" y2="124" stroke="#2563eb" strokeWidth="3" />
              <line x1="382" y1="132" x2="382" y2="176" stroke="#14b8a6" strokeWidth="3" />
              <text x="72" y="156" fill="#334155" fontSize="14" fontWeight="700">Disease</text>
              <text x="214" y="42" fill="#334155" fontSize="14" fontWeight="700">Target</text>
              <text x="214" y="198" fill="#334155" fontSize="14" fontWeight="700">Target</text>
              <text x="372" y="156" fill="#334155" fontSize="14" fontWeight="700">Drug</text>
              <text x="360" y="226" fill="#334155" fontSize="14" fontWeight="700">ncRNA</text>
            </svg>
          </div>
        </div>

        <div className="help-flow card panel-pad">
          <h3>Recommended Query Workflow</h3>
          <div className="help-steps">
            <div className="help-step">
              <div className="step-num">1</div>
              <div className="step-body">
                <div className="step-title">Query a Record</div>
                <div className="muted">Use quick search or a released node identifier to define the analysis center.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">2</div>
              <div className="step-body">
                <div className="step-title">Filter the Network</div>
                <div className="muted">Adjust edge category, evidence class, and graph depth, then expand the selected node.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">3</div>
              <div className="step-body">
                <div className="step-title">Review Evidence</div>
                <div className="muted">Inspect support composition, annotations, chemical structure, SMILES, and target sequence fields.</div>
              </div>
            </div>
            <div className="help-step">
              <div className="step-num">4</div>
              <div className="step-body">
                <div className="step-title">Export Results</div>
                <div className="muted">Export the current subgraph or result tables for downstream review and reporting.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="help-grid">
          <article className="card panel-pad">
            <h3>Disease Network Semantics</h3>
            <ul>
              <li>Node groups: Drug, Target, Disease, ncRNA</li>
              <li>Edge types: Known, Predicted, Known+Predicted</li>
              <li>Disease IDs are normalized as `DIS::...`</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Network Analysis Scope</h3>
            <ul>
              <li>Specify a center node and load the corresponding subgraph</li>
              <li>Filter by edge category, evidence type, and graph depth</li>
              <li>Select nodes to inspect evidence, annotations, and neighborhood context</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Database Table Access</h3>
            <ul>
              <li>Review node and relationship tables with pagination support</li>
              <li>Use structured filters for disease-network review and curation</li>
              <li>View any node directly in the network analysis view</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Disease Network Visual Legend</h3>
            <ul>
              <li>Node color: Drug=blue, Target=orange, Disease=red, ncRNA=teal</li>
              <li>Edge style: Known=solid, Predicted=dashed, Known+Predicted=hybrid</li>
              <li>Node ring segments represent evidence composition</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Interaction Reference</h3>
            <ul>
              <li>Wheel: zoom in/out</li>
              <li>Drag blank area: pan graph</li>
              <li>Double click node: expand one-hop neighbors</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Release Notes</h3>
            <ul>
              <li>The disease network atlas home page provides entry to the released network analysis and result tables</li>
              <li>The database view provides sortable result records, support metrics, and linked record access</li>
              <li>Exports are available for current network views and structured result tables</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
