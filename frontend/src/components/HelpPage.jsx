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
                <linearGradient id="helpGlassBg" x1="0" x2="1">
                  <stop offset="0%" stopColor="#eef5ff" />
                  <stop offset="100%" stopColor="#eefcf9" />
                </linearGradient>
                <linearGradient id="helpLineCool" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#89bdff" />
                  <stop offset="100%" stopColor="#4fd1c5" />
                </linearGradient>
                <linearGradient id="helpLineWarm" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffb867" />
                  <stop offset="100%" stopColor="#ff7d75" />
                </linearGradient>
                <radialGradient id="helpDiseaseCore" cx="50%" cy="46%" r="58%">
                  <stop offset="0%" stopColor="#ff8f86" />
                  <stop offset="100%" stopColor="#ef4444" />
                </radialGradient>
              </defs>
              <rect x="0" y="0" width="560" height="260" fill="url(#helpGlassBg)" rx="18" />
              <ellipse cx="284" cy="126" rx="178" ry="72" fill="rgba(255,255,255,0.42)" />
              <circle cx="104" cy="122" r="20" fill="url(#helpDiseaseCore)" />
              <circle cx="104" cy="122" r="30" fill="none" stroke="rgba(239,68,68,0.26)" strokeWidth="5" />
              <circle cx="245" cy="72" r="16" fill="#fbbf24" />
              <circle cx="245" cy="170" r="16" fill="#f59e0b" />
              <circle cx="402" cy="120" r="17" fill="#3b82f6" />
              <circle cx="402" cy="192" r="17" fill="#2dd4bf" />
              <path d="M122 117C152 97 186 85 228 76" fill="none" stroke="url(#helpLineCool)" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M122 128C152 143 188 153 228 162" fill="none" stroke="url(#helpLineWarm)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="7 5" />
              <path d="M262 76C296 90 332 104 384 117" fill="none" stroke="rgba(129,140,248,0.94)" strokeWidth="3" strokeLinecap="round" />
              <path d="M262 165C303 154 340 140 384 126" fill="none" stroke="rgba(76,154,255,0.92)" strokeWidth="3.1" strokeLinecap="round" />
              <path d="M401 137C401 148 401 162 401 175" fill="none" stroke="rgba(45,212,191,0.92)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="315" cy="103" r="5" fill="rgba(255,255,255,0.94)" />
              <circle cx="346" cy="142" r="4.5" fill="rgba(255,255,255,0.92)" />
              <text x="71" y="160" fill="#334155" fontSize="14" fontWeight="700">Disease</text>
              <text x="214" y="43" fill="#334155" fontSize="14" fontWeight="700">Target</text>
              <text x="214" y="201" fill="#334155" fontSize="14" fontWeight="700">Target</text>
              <text x="372" y="156" fill="#334155" fontSize="14" fontWeight="700">Drug</text>
              <text x="357" y="228" fill="#334155" fontSize="14" fontWeight="700">ncRNA</text>
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
              <li>Edge categories: Drug-Target, Drug-Disease, Target-Disease, ncRNA-Drug, ncRNA-Target, ncRNA-Disease</li>
              <li>Edge types: Known, Predicted, Known+Predicted</li>
              <li>Disease IDs are normalized as `DIS::...`</li>
            </ul>
          </article>
          <article className="card panel-pad">
            <h3>Network Analysis Scope</h3>
            <ul>
              <li>Specify a center node and load the corresponding subgraph</li>
              <li>Filter by edge category, evidence type, and graph depth, including ncRNA-target and ncRNA-disease relations</li>
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
              <li>ncRNA relations include retained known links to drugs, targets, and diseases</li>
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
