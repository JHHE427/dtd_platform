import React from "react";

export default function HomePage({ stats, researchSummary, onAnalyze, onOpenDatabase }) {
  const [keyword, setKeyword] = React.useState("");
  const nodeMap = React.useMemo(
    () => Object.fromEntries((stats?.node_by_type || []).map((x) => [x.node_type, x.count])),
    [stats]
  );
  const edgeTotal = React.useMemo(
    () => (stats?.edge_by_type || []).reduce((sum, x) => sum + x.count, 0),
    [stats]
  );
  const sourceTables = researchSummary?.source_tables || [];
  const predictionSummary = researchSummary?.prediction_summary || null;
  const resultTables = researchSummary?.result_tables || [];
  const edgeSummary = researchSummary?.edge_summary || [];
  const targetDiseaseMatch = researchSummary?.target_disease_match || [];
  const diseaseDistribution = researchSummary?.disease_distribution?.top_diseases || [];
  const diseaseTotalLinks = researchSummary?.disease_distribution?.total_links || 0;
  const representativeDrugs = researchSummary?.representative_drugs || [];
  const algoDistribution = predictionSummary?.algorithm_support_distribution || [];
  const voteDistribution = predictionSummary?.vote_distribution || [];
  const supportPatternDistribution = predictionSummary?.support_pattern_distribution || [];
  const supportPatternCards = React.useMemo(() => {
    const rows = supportPatternDistribution.reduce((acc, item) => {
      acc[item.support_pattern_label] = item.count;
      return acc;
    }, {});
    return [
      {
        title: "TXGNN-only",
        value: rows["TXGNN only"] || 0,
        note: "Rows retained only by graph neural network support."
      },
      {
        title: "ENR-only",
        value: rows["ENR only"] || 0,
        note: "Rows retained only by enrichment-level evidence."
      },
      {
        title: "RWR-only",
        value: rows["RWR only"] || 0,
        note: "Rows retained only by random-walk propagation support."
      },
      {
        title: "Multi-method consensus",
        value:
          (rows["TXGNN + ENR + RWR"] || 0) +
          (rows["TXGNN + ENR"] || 0) +
          (rows["TXGNN + RWR"] || 0) +
          (rows["ENR + RWR"] || 0),
        note: "Rows jointly supported by at least two methods."
      }
    ];
  }, [supportPatternDistribution]);
  const supportPatternLegend = [
    { key: "txgnn_only", label: "TXGNN-only", colorClass: "is-txgnn", value: supportPatternCards[0]?.value || 0 },
    { key: "enr_only", label: "ENR-only", colorClass: "is-enr", value: supportPatternCards[1]?.value || 0 },
    { key: "rwr_only", label: "RWR-only", colorClass: "is-rwr", value: supportPatternCards[2]?.value || 0 },
    { key: "consensus", label: "Consensus", colorClass: "is-consensus", value: supportPatternCards[3]?.value || 0 },
  ];
  const supportPatternTotal = supportPatternLegend.reduce((sum, item) => sum + item.value, 0);
  const coreMethodSupportCards = React.useMemo(() => {
    const rows = algoDistribution.reduce((acc, item) => {
      acc[String(item.algorithm_support)] = item.count;
      return acc;
    }, {});
    return [
      { label: "1-method support", value: rows["1"] || 0, tier: "tier-1", note: "Retained by one released method." },
      { label: "2-method support", value: rows["2"] || 0, tier: "tier-2", note: "Retained by two released methods." },
      { label: "3-method support", value: rows["3"] || 0, tier: "tier-3", note: "Retained by all three released methods." },
    ];
  }, [algoDistribution]);
  const sevenVoteCards = React.useMemo(() => {
    const rows = voteDistribution.reduce((acc, item) => {
      acc[String(item.total_votes)] = item.count;
      return acc;
    }, {});
    return [
      { label: "Low 7-model support", value: (rows["1"] || 0) + (rows["2"] || 0), note: "Supported by one to two DTI models." },
      { label: "Intermediate 7-model support", value: (rows["3"] || 0) + (rows["4"] || 0) + (rows["5"] || 0), note: "Supported by three to five DTI models." },
      { label: "High 7-model support", value: (rows["6"] || 0) + (rows["7"] || 0), note: "Supported by six to seven DTI models." },
    ];
  }, [voteDistribution]);
  const sevenDtiModels = [
    "GraphDTA",
    "DTIAM",
    "DrugBAN",
    "DeepPurpose",
    "DeepDTAGen",
    "MolTrans",
    "Conplex",
  ];
  const methodMatrix = [
    {
      method: "TXGNN",
      input: "Drug-target graph context",
      output: "TXGNN_score and TXGNN_pass",
      meaning: "Graph neural network support for retained associations."
    },
    {
      method: "ENR",
      input: "Enrichment-based disease support",
      output: "ENR_FDR and ENR_pass",
      meaning: "Disease-level statistical support for predicted retention."
    },
    {
      method: "RWR",
      input: "Network propagation",
      output: "RWR_pass",
      meaning: "Random walk evidence contributing to multi-method consistency."
    }
  ];
  const conclusionCards = [
    {
      title: "Formal disease layer expanded",
      value: nodeMap.Disease || 0,
      note: "Disease nodes retained after alias expansion, normalization, and network-level integration."
    },
    {
      title: "Prediction evidence retained",
      value: predictionSummary?.total_rows || 0,
      note: "High-confidence prediction rows remain queryable through the database result table."
    },
    {
      title: "Algorithm-supported screening",
      value: predictionSummary ? `${predictionSummary.txgnn_pass}/${predictionSummary.enr_pass}/${predictionSummary.rwr_pass}` : "NA",
      note: "TXGNN, ENR, and RWR support counts are surfaced as formal evidence indicators."
    }
  ];
  const featureCards = [
    {
      title: "Known + Predicted",
      body: "Integrated presentation of validated associations and model-supported relationships within a unified atlas."
    },
    {
      title: "Interactive Graph",
      body: "Support for graph navigation, local expansion, node inspection, and subnetwork comparison in an interactive network view."
    },
    {
      title: "Multi-Modal Detail",
      body: "Unified display of chemical structures, SMILES, target sequences, ontology terms, summaries, and evidence context."
    }
  ];

  return (
    <section className="page is-active home-page">
      <div className="hero">
        <div className="hero-pill">Released Atlas</div>
        <h1>
          Disease-Target-Drug
          <span>Interaction Atlas</span>
        </h1>
        <p>
          Explore curated known associations, predicted relationships, and algorithm-supported
          evidence within the integrated Drug-Target-Disease atlas.
        </p>
        <div className="hero-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAnalyze(keyword)}
            placeholder="Search by DrugBank ID, target ID, disease name, or alias..."
          />
          <button onClick={() => onAnalyze(keyword)}>Open Atlas View</button>
        </div>
        <div className="home-stats">
          <article className="stat-card">
            <div className="stat-title">Drug Nodes</div>
            <div className="stat-value">{nodeMap.Drug || 0}</div>
          </article>
          <article className="stat-card">
            <div className="stat-title">Target Nodes</div>
            <div className="stat-value">{nodeMap.Target || 0}</div>
          </article>
          <article className="stat-card">
            <div className="stat-title">Disease Nodes</div>
            <div className="stat-value">{nodeMap.Disease || 0}</div>
          </article>
          <article className="stat-card">
            <div className="stat-title">Total Edges</div>
            <div className="stat-value">{edgeTotal}</div>
          </article>
        </div>
        <div className="home-feature-strip">
          {featureCards.map((item) => (
            <article className="home-feature-card" key={item.title}>
              <div className="home-feature-title">{item.title}</div>
              <div className="home-feature-text">{item.body}</div>
            </article>
          ))}
        </div>

        <div className="home-conclusion-grid">
          {conclusionCards.map((item) => (
            <article className="home-conclusion-card" key={item.title}>
              <div className="home-conclusion-title">{item.title}</div>
              <div className="home-conclusion-value">{item.value}</div>
              <div className="home-conclusion-note">{item.note}</div>
            </article>
          ))}
        </div>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Model-Stratified Result Overview</h3>
            <div className="home-panel-subtitle">Prediction records grouped by single-method retention and multi-method consensus support.</div>
          </div>
          <div className="support-tier-grid">
            {coreMethodSupportCards.map((item) => (
              <article className={`support-tier-card ${item.tier}`} key={item.label}>
                <div className="support-tier-label">{item.label}</div>
                <div className="support-tier-value">{item.value}</div>
                <div className="support-tier-note">{item.note}</div>
              </article>
            ))}
          </div>
          <div className="model-overview-strip">
            <div className="model-overview-bar" aria-label="Model-stratified result distribution">
              {supportPatternLegend.map((item) => {
                const width = supportPatternTotal ? `${(item.value / supportPatternTotal) * 100}%` : "0%";
                return <span key={item.key} className={`model-overview-segment ${item.colorClass}`} style={{ width }} />;
              })}
            </div>
            <div className="model-overview-legend">
              {supportPatternLegend.map((item) => (
                <div className="model-overview-legend-item" key={item.key}>
                  <i className={`model-overview-dot ${item.colorClass}`} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="home-conclusion-grid model-result-grid">
            {supportPatternCards.map((item) => (
              <article className="home-conclusion-card model-result-card" key={item.title}>
                <div className="home-conclusion-title">{item.title}</div>
                <div className="home-conclusion-value">{item.value}</div>
                <div className="home-conclusion-note">{item.note}</div>
              </article>
            ))}
          </div>
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Support pattern</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {supportPatternDistribution.length ? supportPatternDistribution.map((row) => (
                  <tr key={row.support_pattern_label}>
                    <td>{row.support_pattern_label}</td>
                    <td>{row.count}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={2}>No model-support summary is available in the current release.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Seven-Model Support Overview</h3>
            <div className="home-panel-subtitle">Prediction records grouped by the number of supporting DTI models in the optional seven-model vote layer.</div>
          </div>
          <div className="support-tier-grid">
            {sevenVoteCards.map((item) => (
              <article className="support-tier-card votes" key={item.label}>
                <div className="support-tier-label">{item.label}</div>
                <div className="support-tier-value">{item.value}</div>
                <div className="support-tier-note">{item.note}</div>
              </article>
            ))}
          </div>
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>7-model votes</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {voteDistribution.length ? voteDistribution.map((row) => (
                  <tr key={row.total_votes}>
                    <td>{row.total_votes}</td>
                    <td>{row.count}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={2}>No seven-model vote summary is available in the current release.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Seven-Model DTI Screening Map</h3>
            <div className="home-panel-subtitle">Seven DTI model outputs are aggregated into the retained DTI vote layer and then interpreted together with TXGNN, ENR, and RWR evidence in the released atlas.</div>
          </div>
          <div className="dti-model-map">
            <div className="dti-model-diagram">
              <svg viewBox="0 0 760 320" role="img" aria-label="Seven-model DTI screening map">
                <defs>
                  <linearGradient id="dtiCenter" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#eff6ff" />
                    <stop offset="100%" stopColor="#dbeafe" />
                  </linearGradient>
                  <linearGradient id="dtiVote" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fff7ed" />
                    <stop offset="100%" stopColor="#ffedd5" />
                  </linearGradient>
                  <linearGradient id="dtiAtlas" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ecfeff" />
                    <stop offset="100%" stopColor="#dcfce7" />
                  </linearGradient>
                </defs>
                <circle cx="230" cy="160" r="104" fill="rgba(37,99,235,0.05)" stroke="#bfdbfe" strokeWidth="2" />
                {sevenDtiModels.map((label, idx) => {
                  const angle = (-Math.PI / 2) + ((Math.PI * 2) / sevenDtiModels.length) * idx;
                  const x = 230 + Math.cos(angle) * 104;
                  const y = 160 + Math.sin(angle) * 104;
                  return (
                    <g key={label}>
                      <path d={`M${230} ${160} Q ${230 + Math.cos(angle) * 48} ${160 + Math.sin(angle) * 48} ${x} ${y}`} fill="none" stroke="rgba(37,99,235,0.28)" strokeWidth="2" />
                      <circle cx={x} cy={y} r="28" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" />
                      <text x={x} y={y + 4} textAnchor="middle" className="dti-model-svg-label">{label}</text>
                    </g>
                  );
                })}
                <circle cx="230" cy="160" r="50" fill="url(#dtiCenter)" stroke="#60a5fa" strokeWidth="3" />
                <text x="230" y="150" textAnchor="middle" className="dti-model-svg-title">7 DTI</text>
                <text x="230" y="172" textAnchor="middle" className="dti-model-svg-sub">model layer</text>

                <path d="M336 160 C 390 126, 408 126, 454 160" fill="none" stroke="#2563eb" strokeWidth="4" />
                <path d="M336 160 C 390 194, 408 194, 454 160" fill="none" stroke="#2563eb" strokeWidth="4" />
                <rect x="454" y="116" width="132" height="88" rx="18" fill="url(#dtiVote)" stroke="#fb923c" strokeWidth="2" />
                <text x="520" y="148" textAnchor="middle" className="dti-model-svg-title">Vote Layer</text>
                <text x="520" y="170" textAnchor="middle" className="dti-model-svg-sub">Total_Votes_Optional7</text>
                <text x="520" y="190" textAnchor="middle" className="dti-model-svg-sub">n_algo_pass</text>

                <path d="M586 160 C 620 138, 642 138, 672 160" fill="none" stroke="#16a34a" strokeWidth="4" />
                <rect x="672" y="102" width="66" height="42" rx="14" fill="#ffffff" stroke="#86efac" strokeWidth="2" />
                <text x="705" y="128" textAnchor="middle" className="dti-model-svg-small">TXGNN</text>
                <rect x="672" y="150" width="66" height="42" rx="14" fill="#ffffff" stroke="#86efac" strokeWidth="2" />
                <text x="705" y="176" textAnchor="middle" className="dti-model-svg-small">ENR</text>
                <rect x="672" y="198" width="66" height="42" rx="14" fill="#ffffff" stroke="#86efac" strokeWidth="2" />
                <text x="705" y="224" textAnchor="middle" className="dti-model-svg-small">RWR</text>
              </svg>
            </div>
            <div className="dti-model-notes">
              <div className="schema-note">
                <strong>Seven DTI model layer</strong>
                <span>GraphDTA, DTIAM, DrugBAN, DeepPurpose, DeepDTAGen, MolTrans, and Conplex contribute raw DTI scores and supporting-model tags.</span>
              </div>
              <div className="schema-note">
                <strong>Vote retention layer</strong>
                <span>The atlas currently exposes this layer through `7-model votes`, `Retained methods`, and per-record supporting-model panels.</span>
              </div>
              <div className="schema-note">
                <strong>Released interpretation layer</strong>
                <span>TXGNN, ENR, and RWR remain the explicit disease-level interpretation modules linked to the final released network.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Atlas Result Summary Figure</h3>
            <div className="home-panel-subtitle">A compact overview linking Drug-Target-Disease structure, known/predicted evidence, seven-model DTI votes, and disease-level interpretation modules.</div>
          </div>
          <div className="atlas-summary-figure">
            <svg viewBox="0 0 1160 320" role="img" aria-label="Atlas result summary figure">
              <defs>
                <linearGradient id="atlasDrug" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="100%" stopColor="#bfdbfe" />
                </linearGradient>
                <linearGradient id="atlasTarget" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="100%" stopColor="#fde68a" />
                </linearGradient>
                <linearGradient id="atlasDisease" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fee2e2" />
                  <stop offset="100%" stopColor="#fecaca" />
                </linearGradient>
                <linearGradient id="atlasMethod" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ede9fe" />
                  <stop offset="100%" stopColor="#ddd6fe" />
                </linearGradient>
                <marker id="atlasArrowBlue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="#2563eb" />
                </marker>
                <marker id="atlasArrowOrange" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
                </marker>
                <marker id="atlasArrowPurple" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="#7c3aed" />
                </marker>
              </defs>

              <circle cx="170" cy="168" r="62" fill="url(#atlasDrug)" stroke="#60a5fa" strokeWidth="3" />
              <text x="170" y="158" textAnchor="middle" className="atlas-summary-title">Drug</text>
              <text x="170" y="182" textAnchor="middle" className="atlas-summary-sub">{nodeMap.Drug || 0} nodes</text>

              <circle cx="378" cy="168" r="62" fill="url(#atlasTarget)" stroke="#f59e0b" strokeWidth="3" />
              <text x="378" y="158" textAnchor="middle" className="atlas-summary-title">Target</text>
              <text x="378" y="182" textAnchor="middle" className="atlas-summary-sub">{nodeMap.Target || 0} nodes</text>

              <circle cx="586" cy="168" r="62" fill="url(#atlasDisease)" stroke="#ef4444" strokeWidth="3" />
              <text x="586" y="158" textAnchor="middle" className="atlas-summary-title">Disease</text>
              <text x="586" y="182" textAnchor="middle" className="atlas-summary-sub">{nodeMap.Disease || 0} nodes</text>

              <path d="M232 168 C 270 120, 320 120, 316 168" fill="none" stroke="#2563eb" strokeWidth="4" markerEnd="url(#atlasArrowBlue)" />
              <path d="M230 190 C 270 228, 320 228, 316 190" fill="none" stroke="#f59e0b" strokeWidth="4" markerEnd="url(#atlasArrowOrange)" />
              <path d="M440 168 C 478 120, 528 120, 524 168" fill="none" stroke="#ef4444" strokeWidth="4" markerEnd="url(#atlasArrowOrange)" />

              <rect x="710" y="74" width="156" height="78" rx="18" fill="#ffffff" stroke="#c7d9f6" strokeWidth="2" />
              <text x="788" y="102" textAnchor="middle" className="atlas-summary-label">Known layer</text>
              <text x="788" y="126" textAnchor="middle" className="atlas-summary-meta">DrugBank / CTD</text>
              <text x="788" y="144" textAnchor="middle" className="atlas-summary-meta">validated relations</text>

              <rect x="710" y="168" width="156" height="88" rx="18" fill="#ffffff" stroke="#fed7aa" strokeWidth="2" />
              <text x="788" y="198" textAnchor="middle" className="atlas-summary-label">Predicted layer</text>
              <text x="788" y="220" textAnchor="middle" className="atlas-summary-meta">7-model DTI votes</text>
              <text x="788" y="238" textAnchor="middle" className="atlas-summary-meta">n_algo / retained rows</text>

              <rect x="928" y="62" width="164" height="56" rx="16" fill="url(#atlasMethod)" stroke="#c4b5fd" strokeWidth="2" />
              <text x="1010" y="95" textAnchor="middle" className="atlas-summary-label">TXGNN</text>
              <rect x="928" y="132" width="164" height="56" rx="16" fill="url(#atlasMethod)" stroke="#c4b5fd" strokeWidth="2" />
              <text x="1010" y="165" textAnchor="middle" className="atlas-summary-label">ENR</text>
              <rect x="928" y="202" width="164" height="56" rx="16" fill="url(#atlasMethod)" stroke="#c4b5fd" strokeWidth="2" />
              <text x="1010" y="235" textAnchor="middle" className="atlas-summary-label">RWR</text>

              <path d="M648 148 C 678 126, 690 120, 710 113" fill="none" stroke="#2563eb" strokeWidth="4" markerEnd="url(#atlasArrowBlue)" />
              <path d="M648 188 C 680 205, 690 208, 710 212" fill="none" stroke="#f59e0b" strokeWidth="4" markerEnd="url(#atlasArrowOrange)" />
              <path d="M866 212 C 896 212, 900 212, 928 230" fill="none" stroke="#7c3aed" strokeWidth="4" markerEnd="url(#atlasArrowPurple)" />
              <path d="M866 212 C 896 198, 900 186, 928 160" fill="none" stroke="#7c3aed" strokeWidth="4" markerEnd="url(#atlasArrowPurple)" />
              <path d="M866 212 C 896 176, 900 146, 928 90" fill="none" stroke="#7c3aed" strokeWidth="4" markerEnd="url(#atlasArrowPurple)" />

              <text x="274" y="112" textAnchor="middle" className="atlas-summary-note">Drug-Target</text>
              <text x="276" y="248" textAnchor="middle" className="atlas-summary-note">Drug-Disease</text>
              <text x="484" y="112" textAnchor="middle" className="atlas-summary-note">Target-Disease</text>
            </svg>
          </div>
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Direct Access to Result Tables</h3>
            <div className="home-panel-subtitle">Direct entry points to released result tables, algorithm summary tables, and prediction records.</div>
          </div>
          <div className="quick-access-grid">
            <button className="quick-access-card" onClick={() => onOpenDatabase?.("predictions")}>
              <strong>Prediction Result Table</strong>
              <span>View the released prediction table with sortable columns, model evidence, and per-record detail.</span>
            </button>
            <button className="quick-access-card" onClick={() => onOpenDatabase?.("algorithms")}>
              <strong>Algorithm Distribution</strong>
              <span>View retained-method distribution, vote layers, and algorithm support summary in the database tables.</span>
            </button>
            <button className="quick-access-card" onClick={() => onOpenDatabase?.("nodes")}>
              <strong>Node and Edge Tables</strong>
              <span>Review unified node and edge tables before drilling down into network-level exploration.</span>
            </button>
          </div>
        </section>

        <section className="home-panel-card home-panel-wide home-schema-card">
          <div className="home-panel-head">
            <h3>Atlas Construction Schema</h3>
            <div className="home-panel-subtitle">End-to-end workflow from curated source tables and multi-method prediction to formal network tables and atlas release.</div>
          </div>
          <div className="schema-kpis">
            <div className="schema-kpi">
              <span className="schema-kpi-label">Formal disease release</span>
              <strong>{nodeMap.Disease || 0}</strong>
            </div>
            <div className="schema-kpi">
              <span className="schema-kpi-label">Prediction result rows</span>
              <strong>{predictionSummary?.total_rows || 0}</strong>
            </div>
            <div className="schema-kpi">
              <span className="schema-kpi-label">Alias-supported disease entries</span>
              <strong>{researchSummary?.overview?.disease_aliases || 0}</strong>
            </div>
          </div>
          <div className="home-schema-layout">
            <svg className="home-schema-svg" viewBox="0 0 1180 250" role="img" aria-label="DTD atlas construction schema">
              <defs>
                <linearGradient id="schemaBlue" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#eff6ff" />
                  <stop offset="100%" stopColor="#dbeafe" />
                </linearGradient>
                <linearGradient id="schemaGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fff7ed" />
                  <stop offset="100%" stopColor="#ffedd5" />
                </linearGradient>
                <linearGradient id="schemaGreen" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ecfeff" />
                  <stop offset="100%" stopColor="#dcfce7" />
                </linearGradient>
                <marker id="schemaArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="#2563eb" />
                </marker>
              </defs>
              <rect x="20" y="30" width="250" height="170" rx="22" fill="url(#schemaBlue)" stroke="#bfdbfe" strokeWidth="2" />
              <text x="46" y="65" className="schema-title">1. Source Data Layers</text>
              <text x="46" y="98" className="schema-line">DrugBank DTI and indications</text>
              <text x="46" y="123" className="schema-line">CTD target-disease associations</text>
              <text x="46" y="148" className="schema-line">High-confidence prediction outputs</text>
              <text x="46" y="173" className="schema-line">Disease aliases and node annotations</text>

              <rect x="330" y="30" width="250" height="170" rx="22" fill="url(#schemaGold)" stroke="#fed7aa" strokeWidth="2" />
              <text x="356" y="65" className="schema-title">2. Processing and Retention</text>
              <text x="356" y="98" className="schema-line">Identifier standardization</text>
              <text x="356" y="123" className="schema-line">Known/predicted edge integration</text>
              <text x="356" y="148" className="schema-line">Loose Target-Disease inclusion</text>
              <text x="356" y="173" className="schema-line">Alias expansion and normalization</text>

              <rect x="640" y="30" width="250" height="170" rx="22" fill="url(#schemaGreen)" stroke="#bbf7d0" strokeWidth="2" />
              <text x="666" y="65" className="schema-title">3. Formal Result Tables</text>
              <text x="666" y="98" className="schema-line">network_nodes_final</text>
              <text x="666" y="123" className="schema-line">network_edges_final</text>
              <text x="666" y="148" className="schema-line">disease_aliases_final</text>
              <text x="666" y="173" className="schema-line">algorithm evidence summaries</text>

              <rect x="950" y="30" width="210" height="170" rx="22" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
              <text x="976" y="65" className="schema-title">4. Atlas Release</text>
              <text x="976" y="98" className="schema-line">{nodeMap.Drug || 0} drug nodes</text>
              <text x="976" y="123" className="schema-line">{nodeMap.Target || 0} target nodes</text>
              <text x="976" y="148" className="schema-line">{nodeMap.Disease || 0} disease nodes</text>
              <text x="976" y="173" className="schema-line">{edgeTotal} integrated edges</text>

              <path d="M270 115 C300 88, 300 142, 330 115" stroke="#2563eb" strokeWidth="4" fill="none" markerEnd="url(#schemaArrow)" />
              <path d="M580 115 C610 88, 610 142, 640 115" stroke="#2563eb" strokeWidth="4" fill="none" markerEnd="url(#schemaArrow)" />
              <path d="M890 115 C920 88, 920 142, 950 115" stroke="#2563eb" strokeWidth="4" fill="none" markerEnd="url(#schemaArrow)" />
            </svg>
            <div className="home-schema-notes">
              <div className="schema-note">
                <strong>Known relation layer</strong>
                <span>Drug-target, drug-disease, and target-disease evidence from curated source tables.</span>
              </div>
              <div className="schema-note">
                <strong>Prediction retention layer</strong>
                <span>TXGNN, ENR, and RWR support is retained as algorithm-specific evidence fields.</span>
              </div>
              <div className="schema-note">
                <strong>Release-facing result layer</strong>
                <span>Formal tables are exposed through the atlas, database browser, and current-network result tables.</span>
              </div>
            </div>
          </div>
        </section>

        <div className="home-research-grid">
          <section className="home-panel-card home-pipeline-card">
            <div className="home-panel-head">
              <h3>Data Integration Workflow</h3>
              <div className="home-panel-subtitle">Primary data sources, algorithm screening, and final atlas output</div>
            </div>
            <div className="pipeline-flow">
              <div className="pipeline-col">
                <div className="pipeline-step is-source">
                  <strong>Input Sources</strong>
                  <span>DrugBank DTI</span>
                  <span>DrugBank indication data</span>
                  <span>CTD gene-disease associations</span>
                  <span>TXGNN / ENR / RWR prediction outputs</span>
                </div>
              </div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-col">
                <div className="pipeline-step is-process">
                  <strong>Processing</strong>
                  <span>Identifier standardization</span>
                  <span>Disease normalization and alias expansion</span>
                  <span>Known/predicted edge integration</span>
                  <span>Loose Target-Disease matching retention</span>
                </div>
              </div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-col">
                <div className="pipeline-step is-output">
                  <strong>Atlas Output</strong>
                  <span>{nodeMap.Drug || 0} drug nodes</span>
                  <span>{nodeMap.Target || 0} target nodes</span>
                  <span>{nodeMap.Disease || 0} disease nodes</span>
                  <span>{edgeTotal} formal network edges</span>
                </div>
              </div>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Algorithm Result Summary</h3>
              <div className="home-panel-subtitle">Prediction-support composition retained in the current release</div>
            </div>
            {predictionSummary ? (
              <div className="result-table-wrap">
                <table className="result-table compact">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Prediction rows</td><td>{predictionSummary.total_rows}</td></tr>
                    <tr><td>Predicted drugs</td><td>{predictionSummary.drugs}</td></tr>
                    <tr><td>Predicted targets</td><td>{predictionSummary.targets}</td></tr>
                    <tr><td>Predicted diseases</td><td>{predictionSummary.diseases}</td></tr>
                    <tr><td>TXGNN pass</td><td>{predictionSummary.txgnn_pass}</td></tr>
                    <tr><td>ENR pass</td><td>{predictionSummary.enr_pass}</td></tr>
                    <tr><td>RWR pass</td><td>{predictionSummary.rwr_pass}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state">Release-level research summary is not available.</div>}
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Method-to-Result Matrix</h3>
            <div className="home-panel-subtitle">Primary algorithm outputs surfaced in the database browser and released result tables.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Input basis</th>
                    <th>Output fields</th>
                    <th>Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {methodMatrix.map((row) => (
                    <tr key={row.method}>
                      <td>{row.method}</td>
                      <td>{row.input}</td>
                      <td>{row.output}</td>
                      <td>{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
            <h3>Source Dataset Table</h3>
            <div className="home-panel-subtitle">Rows incorporated from major source datasets in the current release.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Dataset</th>
                    <th>Rows</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceTables.map((item) => (
                    <tr key={item.dataset}>
                      <td>{item.dataset}</td>
                      <td>{item.rows}</td>
                      <td>{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Formal Result Tables</h3>
              <div className="home-panel-subtitle">Current release tables available for browsing and export</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Rows</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {resultTables.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.rows}</td>
                      <td>{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Disease Distribution Summary</h3>
              <div className="home-panel-subtitle">Top disease nodes ranked by retained Drug-Disease and Target-Disease connectivity in the released atlas.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Disease</th>
                    <th>Edges</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {diseaseDistribution.length ? diseaseDistribution.map((item) => (
                    <tr key={item.disease_id}>
                      <td>{item.disease_label}</td>
                      <td><span className="result-emphasis-number">{item.edge_count}</span></td>
                      <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3}>No disease-distribution summary is available in the current release.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{diseaseTotalLinks}</strong>
                <em>Disease-linked edges</em>
              </span>
              {diseaseDistribution[0] ? (
                <span className="result-summary-pill">
                  <strong>{diseaseDistribution[0].share_pct}%</strong>
                  <em>Top disease share</em>
                </span>
              ) : null}
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Representative Clinical Drugs</h3>
              <div className="home-panel-subtitle">Selected retained drugs highlighted in the report, shown with their leading disease association in the current high-confidence result table.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Drug ID</th>
                    <th>Leading disease</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                    <th>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {representativeDrugs.length ? representativeDrugs.map((item) => (
                    <tr key={item.drug_id}>
                      <td><span className="result-emphasis-label">{item.drug_label}</span></td>
                      <td><span className="result-id-chip">{item.drug_id}</span></td>
                      <td>{item.disease_label || "Retained in atlas"}</td>
                      <td><span className="result-emphasis-number">{item.txgnn_score ?? "-"}</span></td>
                      <td>{item.enr_fdr != null ? <span className="result-emphasis-chip is-soft">{item.enr_fdr}</span> : "-"}</td>
                      <td>{item.n_algo_pass != null ? <span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.seven_model_votes}/7</span> : "-"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6}>No representative-drug summary is available in the current release.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Network Composition</h3>
              <div className="home-panel-subtitle">Final edge classes retained in the current atlas</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Edge category</th>
                    <th>Evidence type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeSummary.map((item) => (
                    <tr key={`${item.edge_category}-${item.edge_type}`}>
                      <td>{item.edge_category}</td>
                      <td>{item.edge_type}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Target-Disease Matching Summary</h3>
              <div className="home-panel-subtitle">Loose matching contribution retained for disease expansion</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Match type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {targetDiseaseMatch.map((item) => (
                    <tr key={item.match_type}>
                      <td>{item.match_type}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Algorithm Support Distribution</h3>
              <div className="home-panel-subtitle">Number of algorithms supporting each retained prediction row</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>n_algo_pass</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {algoDistribution.map((item) => (
                    <tr key={item.algorithm_support}>
                      <td>{item.algorithm_support}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Vote Distribution</h3>
              <div className="home-panel-subtitle">Optional vote counts retained in the current high-confidence prediction table</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Total votes</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {voteDistribution.map((item) => (
                    <tr key={item.total_votes}>
                      <td>{item.total_votes}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
