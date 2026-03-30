import React from "react";

const SEVEN_DTI_MODEL_META = [
  { key: "graphdta", label: "GraphDTA" },
  { key: "dtiam", label: "DTIAM" },
  { key: "drugban", label: "DrugBAN" },
  { key: "deeppurpose", label: "DeepPurpose" },
  { key: "deepdtagen", label: "DeepDTAGen" },
  { key: "moltrans", label: "MolTrans" },
  { key: "conplex", label: "Conplex" },
];

function buildDtiHeatmap(modelCoverage, topPairs) {
  const labels = SEVEN_DTI_MODEL_META.map((item) => item.label);
  const coverageMap = Object.fromEntries((modelCoverage || []).map((item) => [item.model, Number(item.count || 0)]));
  const pairMap = {};
  (topPairs || []).forEach((item) => {
    const parts = String(item.pair_label || "").split(" + ");
    if (parts.length !== 2) return;
    const [a, b] = parts;
    pairMap[`${a}|${b}`] = Number(item.count || 0);
    pairMap[`${b}|${a}`] = Number(item.count || 0);
  });
  const maxValue = Math.max(
    1,
    ...labels.map((label) => coverageMap[label] || 0),
    ...(topPairs || []).map((item) => Number(item.count || 0))
  );
  const rows = labels.map((rowLabel) => ({
    rowLabel,
    cells: labels.map((colLabel) => {
      const value = rowLabel === colLabel ? (coverageMap[rowLabel] || 0) : (pairMap[`${rowLabel}|${colLabel}`] || 0);
      return {
        rowLabel,
        colLabel,
        value,
        intensity: Math.max(0.08, value / maxValue),
      };
    }),
  }));
  return { labels, rows };
}

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
  const drugDistribution = researchSummary?.drug_distribution?.top_drugs || [];
  const targetDistribution = researchSummary?.target_distribution?.top_targets || [];
  const predictionResultTotal = researchSummary?.drug_distribution?.total_rows || 0;
  const representativeDrugs = researchSummary?.representative_drugs || [];
  const representativeCases = researchSummary?.representative_cases || [];
  const approvedValidation = researchSummary?.approved_validation || null;
  const pipelineShrinkage = researchSummary?.pipeline_shrinkage || null;
  const supportTierOverview = researchSummary?.support_tier_overview || null;
  const diseaseResults = researchSummary?.disease_results || [];
  const diseaseSpotlights = researchSummary?.disease_spotlights || [];
  const drugSpotlights = researchSummary?.drug_spotlights || [];
  const targetSpotlights = researchSummary?.target_spotlights || [];
  const highConsensusCases = researchSummary?.high_consensus_cases || [];
  const topConsensusLeaderboard = researchSummary?.top_consensus_leaderboard || [];
  const approvedDrugDeepResults = researchSummary?.approved_drug_deep_results || [];
  const topApprovedLeaderboard = researchSummary?.top_approved_leaderboard || [];
  const algoDistribution = predictionSummary?.algorithm_support_distribution || [];
  const voteDistribution = predictionSummary?.vote_distribution || [];
  const supportPatternDistribution = predictionSummary?.support_pattern_distribution || [];
  const dtiModelConsistency = predictionSummary?.dti_model_consistency || null;
  const dtiModelCoverage = dtiModelConsistency?.model_coverage || [];
  const dtiTopPairs = dtiModelConsistency?.top_pairs || [];
  const dtiTopPatterns = dtiModelConsistency?.top_patterns || [];
  const dtiHeatmap = React.useMemo(() => buildDtiHeatmap(dtiModelCoverage, dtiTopPairs), [dtiModelCoverage, dtiTopPairs]);
  const topDiseaseShare = diseaseDistribution[0]?.share_pct ?? null;
  const topDtiModel = dtiModelCoverage[0] || null;
  const topDtiPair = dtiTopPairs[0] || null;
  const topDtiPattern = dtiTopPatterns[0] || null;
  const leadingApprovedCase = topApprovedLeaderboard[0] || approvedDrugDeepResults[0] || null;
  const leadingConsensusCase = topConsensusLeaderboard[0] || highConsensusCases[0] || null;
  const leadingDiseaseCase = diseaseSpotlights[0] || diseaseResults[0] || null;
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
  const sevenDtiModels = SEVEN_DTI_MODEL_META.map((item) => item.label);
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
  const keyFindings = [
    {
      title: "Pipeline retention",
      value: pipelineShrinkage ? `${pipelineShrinkage.vote4_retained.toLocaleString()} retained` : "NA",
      note: pipelineShrinkage ? `from ${pipelineShrinkage.raw_dti_pairs.toLocaleString()} raw DTI pairs into the vote-filtered layer.` : "Pipeline retention summary is unavailable.",
    },
    {
      title: "Disease concentration",
      value: topDiseaseShare != null ? `${topDiseaseShare}%` : "NA",
      note: topDiseaseShare != null ? "Top disease share in the released prediction layer." : "Disease concentration summary is unavailable.",
    },
    {
      title: "Approved-drug retention",
      value: approvedValidation ? `${approvedValidation.retained_final}/${approvedValidation.entered_high_confidence}` : "NA",
      note: approvedValidation ? `${approvedValidation.final_retention_pct}% of approved drugs entering the high-confidence set remain in the final network.` : "Approved-drug validation summary is unavailable.",
    },
    {
      title: "Strongest DTI co-support",
      value: topDtiPair?.pair_label || "NA",
      note: topDtiPair ? `${topDtiPair.count} released rows (${topDtiPair.share_pct}%) are jointly supported by this model pair.` : "Seven-model co-support summary is unavailable.",
    },
  ];
  const fixedCaseStudies = [
    leadingApprovedCase ? {
      key: "approved",
      title: "Approved-drug case",
      primaryLabel: leadingApprovedCase.drug_label,
      primaryId: leadingApprovedCase.drug_id,
      secondary: `${leadingApprovedCase.target_label || "-"} -> ${leadingApprovedCase.disease_label || "-"}`,
      metrics: `${leadingApprovedCase.n_algo_pass || leadingApprovedCase.max_algo_pass || 0}/3 · ${leadingApprovedCase.Total_Votes_Optional7 || leadingApprovedCase.max_votes || 0}/7`,
      score: leadingApprovedCase.TXGNN_score ?? leadingApprovedCase.top_txgnn_score ?? "-",
      fdr: leadingApprovedCase.ENR_FDR ?? leadingApprovedCase.best_enr_fdr ?? "-",
      conclusion: "An approved drug remains in the formal network after multi-method retention and DTI vote filtering.",
    } : null,
    leadingConsensusCase ? {
      key: "consensus",
      title: "Consensus case",
      primaryLabel: leadingConsensusCase.drug_label,
      primaryId: leadingConsensusCase.drug_id,
      secondary: `${leadingConsensusCase.target_label || "-"} -> ${leadingConsensusCase.disease_label || "-"}`,
      metrics: `${leadingConsensusCase.n_algo_pass || 0}/3 · ${leadingConsensusCase.Total_Votes_Optional7 || 0}/7`,
      score: leadingConsensusCase.TXGNN_score ?? "-",
      fdr: leadingConsensusCase.ENR_FDR ?? "-",
      conclusion: "This released row is retained by the strongest joint support tier across released methods and the seven-model vote layer.",
    } : null,
    leadingDiseaseCase ? {
      key: "disease",
      title: "Disease-focused case",
      primaryLabel: leadingDiseaseCase.disease_label,
      primaryId: leadingDiseaseCase.disease_id,
      secondary: `${leadingDiseaseCase.top_drug_label || "-"} / ${leadingDiseaseCase.top_target_label || "-"}`,
      metrics: `${leadingDiseaseCase.max_algo_pass || 0}/3 · ${leadingDiseaseCase.max_votes || 0}/7`,
      score: leadingDiseaseCase.top_txgnn_score ?? "-",
      fdr: leadingDiseaseCase.best_enr_fdr ?? "-",
      conclusion: "This disease-centered summary highlights the dominant retained drug-target context within the released atlas.",
    } : null,
  ].filter(Boolean);
  const featureCards = [
    {
      title: "Released Evidence Layers",
      body: "Curated known associations and retained prediction rows are organized into a unified release-facing evidence structure."
    },
    {
      title: "Network Query and Analysis",
      body: "The released atlas supports graph navigation, local expansion, node inspection, and subnetwork comparison within the network analysis view."
    },
    {
      title: "Structured Record Annotations",
      body: "Chemical structures, SMILES, target sequences, ontology terms, summaries, and evidence context are presented within structured atlas records."
    }
  ];

  return (
    <section className="page is-active home-page">
      <div className="hero">
        <div className="hero-pill">Formal Release</div>
        <h1>
          Disease-Target-Drug
          <span>Interaction Atlas</span>
        </h1>
        <p>
          Access curated known associations, retained prediction results, and algorithm-supported
          evidence within the released Drug-Target-Disease atlas.
        </p>
        <div className="hero-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAnalyze(keyword)}
            placeholder="Search by DrugBank ID, target ID, disease name, or alias..."
          />
          <button onClick={() => onAnalyze(keyword)}>Access Network Analysis</button>
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
            <h3>Release Result Inventory</h3>
            <div className="home-panel-subtitle">A compact index of the result families included in the current release before browsing detailed tables and network views.</div>
          </div>
          <div className="result-summary-strip">
            <span className="result-summary-pill">
              <strong>{pipelineShrinkage ? 5 : 0}</strong>
              <em>Pipeline stages</em>
            </span>
            <span className="result-summary-pill">
              <strong>{diseaseSpotlights.length + drugSpotlights.length + targetSpotlights.length}</strong>
              <em>Summary tables</em>
            </span>
            <span className="result-summary-pill">
              <strong>{highConsensusCases.length + topConsensusLeaderboard.length}</strong>
                <em>Consensus result rows</em>
            </span>
            <span className="result-summary-pill">
              <strong>{approvedDrugDeepResults.length + topApprovedLeaderboard.length}</strong>
              <em>Approved-drug rows</em>
            </span>
            <span className="result-summary-pill">
              <strong>{resultTables.length}</strong>
              <em>Formal result tables</em>
            </span>
          </div>
        </section>

        <div className="home-priority-grid">
          <div className="home-priority-stack">
            <section className="home-panel-card">
              <div className="home-panel-head">
                <h3>Key Findings</h3>
                <div className="home-panel-subtitle">Release-level statements highlighting retention, disease concentration, approved-drug retention, and seven-model agreement.</div>
              </div>
              <div className="key-findings-grid">
                {keyFindings.map((item) => (
                  <article className="key-finding-card" key={item.title}>
                    <div className="key-finding-title">{item.title}</div>
                    <div className="key-finding-value">{item.value}</div>
                    <div className="key-finding-note">{item.note}</div>
                  </article>
                ))}
              </div>
            </section>
            <section className="home-panel-card">
              <div className="home-panel-head">
                <h3>Fixed Case Studies</h3>
                <div className="home-panel-subtitle">Selected released records pinned for direct review in the formal atlas instead of relying only on free-form browsing.</div>
              </div>
              <div className="fixed-case-grid">
                {fixedCaseStudies.length ? fixedCaseStudies.map((item) => (
                  <article className="fixed-case-card" key={item.key}>
                    <div className="fixed-case-tag">{item.title}</div>
                    <button className="result-link-btn fixed-case-link" onClick={() => onAnalyze(item.primaryId)}>
                      <span className="result-emphasis-label">{item.primaryLabel}</span>
                    </button>
                    <div className="fixed-case-secondary">{item.secondary}</div>
                    <div className="fixed-case-conclusion">{item.conclusion}</div>
                    <div className="fixed-case-metrics">
                      <span className="result-emphasis-chip">{item.metrics}</span>
                      <span className="result-emphasis-number">{item.score}</span>
                      <span className="result-emphasis-chip is-soft">{item.fdr}</span>
                    </div>
                  </article>
                )) : <div className="empty-state">No fixed case-study rows are available in the current release.</div>}
              </div>
            </section>
          </div>

          <section className="home-panel-card home-seven-model-card home-priority-seven">
            <div className="home-panel-head">
              <h3>Seven DTI Models</h3>
              <div className="home-panel-subtitle">The released atlas integrates seven upstream DTI models in the optional vote layer before retention by TXGNN, ENR, and RWR.</div>
            </div>
            <div className="seven-model-section-note">
              <span className="seven-model-note-badge">Unified atlas palette</span>
              <span className="seven-model-note-text">The same model order and color encoding are preserved on the homepage, the analysis view, and the prediction result table.</span>
            </div>
            <div className="seven-model-chip-grid">
              {SEVEN_DTI_MODEL_META.map((model) => (
                <article className={`seven-model-chip-card model-${model.key}`} key={model.label}>
                  <strong>{model.label}</strong>
                  <span>Included in DTI screening</span>
                </article>
              ))}
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>7 models</strong>
                <em>Explicitly displayed in the atlas</em>
              </span>
              <span className="result-summary-pill">
                <strong>{predictionSummary?.total_rows || 0}</strong>
                <em>Rows linked to the DTI vote layer</em>
              </span>
              {topDtiModel ? (
                <span className="result-summary-pill">
                  <strong>{topDtiModel.model}</strong>
                  <em>{topDtiModel.count} released rows</em>
                </span>
              ) : null}
              {topDtiPair ? (
                <span className="result-summary-pill">
                  <strong>{topDtiPair.pair_label}</strong>
                  <em>{topDtiPair.count} top co-support rows</em>
                </span>
              ) : null}
              {topDtiPattern ? (
                <span className="result-summary-pill">
                  <strong>{topDtiPattern.pattern_label}</strong>
                  <em>{topDtiPattern.count} top support pattern rows</em>
                </span>
              ) : null}
            </div>
            <div className="home-action-row">
              <button className="quick-access-card is-inline-action" onClick={() => onOpenDatabase?.("predictions")}>
                <strong>View Prediction Result Table</strong>
                <span>View the 7 DTI models for each released prediction record.</span>
              </button>
            </div>
          </section>
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
            <h3>Seven-Model DTI Consistency</h3>
            <div className="home-panel-subtitle">Coverage and co-support patterns across GraphDTA, DTIAM, DrugBAN, DeepPurpose, DeepDTAGen, MolTrans, and Conplex in the released prediction rows.</div>
          </div>
          <div className="seven-model-chip-grid dti-consistency-grid">
            {dtiModelCoverage.length ? dtiModelCoverage.map((item) => {
              const meta = SEVEN_DTI_MODEL_META.find((x) => x.label === item.model);
              return (
                <article className={`seven-model-chip-card model-${meta?.key || "graphdta"} dti-consistency-card`} key={item.model}>
                  <strong>{item.model}</strong>
                  <span>{item.count} released rows</span>
                  <span>{item.share_pct}% of retained predictions</span>
                  <span>avg score {item.avg_score ?? "-"}</span>
                </article>
              );
            }) : null}
          </div>
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>DTI co-support heatmap</strong>
              <span>Diagonal cells show per-model coverage; off-diagonal cells show pairwise co-support counts.</span>
            </div>
            <div className="dti-heatmap-grid" style={{ gridTemplateColumns: `120px repeat(${dtiHeatmap.labels.length}, minmax(0, 1fr))` }}>
              <div className="dti-heatmap-corner" />
              {dtiHeatmap.labels.map((label) => (
                <div className="dti-heatmap-axis" key={`col-${label}`}>{label}</div>
              ))}
              {dtiHeatmap.rows.map((row) => (
                <React.Fragment key={row.rowLabel}>
                  <div className="dti-heatmap-axis is-row">{row.rowLabel}</div>
                  {row.cells.map((cell) => {
                    const meta = SEVEN_DTI_MODEL_META.find((item) => item.label === cell.colLabel) || SEVEN_DTI_MODEL_META[0];
                    return (
                      <div
                        key={`${cell.rowLabel}-${cell.colLabel}`}
                        className={`dti-heatmap-cell model-${meta.key} ${cell.rowLabel === cell.colLabel ? "is-diagonal" : ""}`}
                        style={{ opacity: cell.intensity }}
                        title={`${cell.rowLabel} × ${cell.colLabel}: ${cell.value}`}
                      >
                        {cell.value}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="home-result-two-col">
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Top DTI model pair</th>
                    <th>Rows</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {dtiTopPairs.length ? dtiTopPairs.map((row) => (
                    <tr key={row.pair_label}>
                      <td>{row.pair_label}</td>
                      <td>{row.count}</td>
                      <td>{row.share_pct}%</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3}>No seven-model pair summary is available in the current release.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Top seven-model pattern</th>
                    <th>Rows</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {dtiTopPatterns.length ? dtiTopPatterns.map((row) => (
                    <tr key={row.pattern_label}>
                      <td>{row.pattern_label}</td>
                      <td>{row.count}</td>
                      <td>{row.share_pct}%</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3}>No seven-model pattern summary is available in the current release.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Released-Method vs DTI-Model Consistency</h3>
            <div className="home-panel-subtitle">A direct comparison between the released interpretation layer (TXGNN, ENR, RWR) and the upstream seven-model DTI support layer.</div>
          </div>
          <div className="home-result-two-col">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>Released-method consistency</strong>
                <span>The three released methods define the disease-level interpretation tier retained in the atlas.</span>
              </div>
              <div className="model-overview-strip">
                <div className="model-overview-bar" aria-label="Released-method support distribution">
                  {supportPatternLegend.map((item) => {
                    const width = supportPatternTotal ? `${(item.value / supportPatternTotal) * 100}%` : "0%";
                    return <span key={`compare-${item.key}`} className={`model-overview-segment ${item.colorClass}`} style={{ width }} />;
                  })}
                </div>
                <div className="model-overview-legend">
                  {supportPatternLegend.map((item) => (
                    <div className="model-overview-legend-item" key={`compare-legend-${item.key}`}>
                      <i className={`model-overview-dot ${item.colorClass}`} />
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>Seven-model DTI consistency</strong>
                <span>The upstream DTI layer shows which of the seven models most frequently agree before atlas release filtering.</span>
              </div>
              <div className="dti-heatmap-grid" style={{ gridTemplateColumns: `120px repeat(${dtiHeatmap.labels.length}, minmax(0, 1fr))` }}>
                <div className="dti-heatmap-corner" />
                {dtiHeatmap.labels.map((label) => (
                  <div className="dti-heatmap-axis" key={`compare-col-${label}`}>{label}</div>
                ))}
                {dtiHeatmap.rows.map((row) => (
                  <React.Fragment key={`compare-${row.rowLabel}`}>
                    <div className="dti-heatmap-axis is-row">{row.rowLabel}</div>
                    {row.cells.map((cell) => {
                      const meta = SEVEN_DTI_MODEL_META.find((item) => item.label === cell.colLabel) || SEVEN_DTI_MODEL_META[0];
                      return (
                        <div
                          key={`compare-${cell.rowLabel}-${cell.colLabel}`}
                          className={`dti-heatmap-cell model-${meta.key} ${cell.rowLabel === cell.colLabel ? "is-diagonal" : ""}`}
                          style={{ opacity: cell.intensity }}
                          title={`${cell.rowLabel} × ${cell.colLabel}: ${cell.value}`}
                        >
                          {cell.value}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
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
            <h3>Result Table Access</h3>
            <div className="home-panel-subtitle">Direct entry points to released result tables, algorithm summaries, and retained prediction records.</div>
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
              <span>Review released node and relationship tables before drilling down into network-level analysis.</span>
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
                <span>Formal tables are exposed through the atlas, database tables, and current-network result tables.</span>
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
            <div className="home-panel-subtitle">Primary algorithm outputs surfaced in the database tables and released result views.</div>
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
              <h3>Approved Drug Validation</h3>
              <div className="home-panel-subtitle">External validation summary extracted from the formal report, showing coverage, retention, and score separation between approved and non-approved drugs.</div>
            </div>
            {approvedValidation ? (
              <>
                <div className="home-conclusion-grid model-result-grid">
                  <article className="home-conclusion-card model-result-card">
                    <div className="home-conclusion-title">Approved drugs</div>
                    <div className="home-conclusion-value">{approvedValidation.approved_total}</div>
                    <div className="home-conclusion-note">DrugBank approved entries referenced for external validation.</div>
                  </article>
                  <article className="home-conclusion-card model-result-card">
                    <div className="home-conclusion-title">Entered DTI space</div>
                    <div className="home-conclusion-value">{approvedValidation.entered_dti_space}</div>
                    <div className="home-conclusion-note">{approvedValidation.dti_space_coverage_pct}% of approved drugs were represented in the upstream DTI model space.</div>
                  </article>
                  <article className="home-conclusion-card model-result-card">
                    <div className="home-conclusion-title">Final retention</div>
                    <div className="home-conclusion-value">{approvedValidation.retained_final}</div>
                    <div className="home-conclusion-note">{approvedValidation.final_retention_pct}% of approved drugs were retained after entering the high-confidence candidate set.</div>
                  </article>
                </div>
                <div className="result-table-wrap">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>Validation metric</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Approved drugs in DrugBank</td><td>{approvedValidation.approved_total}</td></tr>
                      <tr><td>Entered DTI model space</td><td>{approvedValidation.entered_dti_space}</td></tr>
                      <tr><td>Entered high-confidence candidate set</td><td>{approvedValidation.entered_high_confidence}</td></tr>
                      <tr><td>Retained in final network</td><td>{approvedValidation.retained_final}</td></tr>
                      <tr><td>Approved mean TXGNN score</td><td>{approvedValidation.approved_mean_txgnn}</td></tr>
                      <tr><td>Non-approved mean TXGNN score</td><td>{approvedValidation.nonapproved_mean_txgnn}</td></tr>
                      <tr><td>Mann-Whitney U p-value</td><td>{approvedValidation.mann_whitney_p}</td></tr>
                      <tr><td>Cohen&apos;s d</td><td>{approvedValidation.cohens_d}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="prediction-support-pattern">{approvedValidation.summary}</div>
              </>
            ) : (
              <div className="empty-state">No approved-drug validation summary is available in the current release.</div>
            )}
          </section>

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
              <h3>Selected Clinical Drug Results</h3>
              <div className="home-panel-subtitle">Retained clinical drugs highlighted in the report, shown with their leading disease association in the current high-confidence result table.</div>
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
              <h3>Pipeline Shrinkage Summary</h3>
              <div className="home-panel-subtitle">Scale reduction from raw DTI candidates to the released atlas network and retained prediction rows.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Rows / Records</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineShrinkage ? (
                    <>
                      <tr><td>Raw DTI pairs</td><td><span className="result-emphasis-number">{pipelineShrinkage.raw_dti_pairs}</span></td></tr>
                      <tr><td>Vote≥4 retained</td><td><span className="result-emphasis-number">{pipelineShrinkage.vote4_retained}</span></td></tr>
                      <tr><td>Released prediction rows</td><td><span className="result-emphasis-number">{pipelineShrinkage.released_prediction_rows}</span></td></tr>
                      <tr><td>Formal network edges</td><td><span className="result-emphasis-number">{pipelineShrinkage.formal_network_edges}</span></td></tr>
                      <tr><td>Formal network nodes</td><td><span className="result-emphasis-number">{pipelineShrinkage.formal_nodes}</span></td></tr>
                    </>
                  ) : (
                    <tr><td colSpan={2}>No pipeline shrinkage summary is available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Support Tier Overview</h3>
              <div className="home-panel-subtitle">Released-method tiers and seven-model vote tiers summarizing support strength across retained prediction rows.</div>
            </div>
            <div className="home-research-grid inner-result-grid">
              <div className="result-table-wrap">
                <table className="result-table compact">
                  <thead>
                    <tr>
                      <th>Released support</th>
                      <th>Rows</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(supportTierOverview?.released_support || []).length ? supportTierOverview.released_support.map((item) => (
                      <tr key={item.tier}>
                        <td>{item.tier}</td>
                        <td><span className="result-emphasis-number">{item.count}</span></td>
                        <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3}>No released-support tier summary is available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="result-table-wrap">
                <table className="result-table compact">
                  <thead>
                    <tr>
                      <th>7-model votes</th>
                      <th>Rows</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(supportTierOverview?.seven_model_support || []).length ? supportTierOverview.seven_model_support.map((item) => (
                      <tr key={item.tier}>
                        <td>{item.tier}</td>
                        <td><span className="result-emphasis-number">{item.count}</span></td>
                        <td><span className="result-emphasis-chip is-soft">{item.share_pct}%</span></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3}>No seven-model support-tier summary is available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {supportTierOverview ? (
              <div className="result-summary-strip">
                <span className="result-summary-pill">
                  <strong>{supportTierOverview.high_consensus_rows}</strong>
                  <em>High-consensus rows</em>
                </span>
              </div>
            ) : null}
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Consensus Result Table</h3>
              <div className="home-panel-subtitle">Released rows jointly retained by TXGNN, ENR, and RWR with strong support from the seven-model DTI layer.</div>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{highConsensusCases.length}</strong>
                <em>High-consensus rows</em>
              </span>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>Support</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {highConsensusCases.length ? highConsensusCases.map((item, idx) => (
                    <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}>
                          <span className="result-emphasis-label">{item.drug_label}</span>
                        </button>
                      </td>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>
                          {item.target_label}
                        </button>
                      </td>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>
                          {item.disease_label}
                        </button>
                      </td>
                      <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                      <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                      <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}>No high-consensus results are available for the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Disease Result Table</h3>
              <div className="home-panel-subtitle">Disease-centered summaries ranked by released row count, strongest retained support, and peak seven-model vote support.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Disease</th>
                    <th>Rows</th>
                    <th>Max support</th>
                    <th>Max votes</th>
                    <th>Top TXGNN</th>
                    <th>Best ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {diseaseResults.length ? diseaseResults.map((item) => (
                    <tr key={item.disease_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>
                          <span className="result-emphasis-label">{item.disease_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3</span></td>
                      <td><span className="result-emphasis-chip is-soft">{item.max_votes}/7</span></td>
                      <td><span className="result-emphasis-number">{item.top_txgnn_score ?? "-"}</span></td>
                      <td>{item.best_enr_fdr != null ? <span className="result-emphasis-chip is-soft">{item.best_enr_fdr}</span> : "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}>No disease-centered result table is available for the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Disease Summary Table</h3>
              <div className="home-panel-subtitle">Top diseases summarized with leading drugs, targets, and retained support peaks.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Disease</th>
                    <th>Rows</th>
                    <th>Top drug</th>
                    <th>Top target</th>
                    <th>Best support</th>
                    <th>Best votes</th>
                  </tr>
                </thead>
                <tbody>
                  {diseaseSpotlights.length ? diseaseSpotlights.map((item) => (
                    <tr key={item.disease_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>
                          <span className="result-emphasis-label">{item.disease_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td>{item.top_drug_label || "-"}</td>
                      <td>{item.top_target_label || "-"}</td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3</span></td>
                      <td><span className="result-emphasis-chip is-soft">{item.max_votes}/7</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}>No disease summary rows are available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Drug Summary Table</h3>
              <div className="home-panel-subtitle">Top retained drugs with their leading disease, leading target, and strongest released support tier.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Rows</th>
                    <th>Top disease</th>
                    <th>Top target</th>
                    <th>Best support</th>
                  </tr>
                </thead>
                <tbody>
                  {drugSpotlights.length ? drugSpotlights.map((item) => (
                    <tr key={item.drug_id}>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td>{item.top_disease_label || "-"}</td>
                      <td>{item.top_target_label || "-"}</td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                    </tr>
                  )) : <tr><td colSpan={5}>No drug summary rows are available in the current release.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Target Summary Table</h3>
              <div className="home-panel-subtitle">Top retained targets with their leading disease, leading drug, and strongest released support tier.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Rows</th>
                    <th>Top disease</th>
                    <th>Top drug</th>
                    <th>Best support</th>
                  </tr>
                </thead>
                <tbody>
                  {targetSpotlights.length ? targetSpotlights.map((item) => (
                    <tr key={item.target_id}>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}><span className="result-emphasis-label">{item.target_label}</span></button></td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td>{item.top_disease_label || "-"}</td>
                      <td>{item.top_drug_label || "-"}</td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                    </tr>
                  )) : <tr><td colSpan={5}>No target summary rows are available in the current release.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Drug Result Distribution</h3>
              <div className="home-panel-subtitle">Top retained drugs ranked by the number of released prediction rows in the current atlas release.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Rows</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {drugDistribution.length ? drugDistribution.map((item) => (
                    <tr key={item.drug_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}>
                          <span className="result-emphasis-label">{item.drug_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3}>No drug-level distribution is available in the current release.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Target Result Distribution</h3>
              <div className="home-panel-subtitle">Top retained targets ranked by the number of released prediction rows in the current atlas release.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Rows</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {targetDistribution.length ? targetDistribution.map((item) => (
                    <tr key={item.target_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>
                          <span className="result-emphasis-label">{item.target_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3}>No target-level distribution is available in the current release.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Approved Drug Result Table</h3>
              <div className="home-panel-subtitle">Approved drugs ranked by retained row count, strongest released support, and best atlas-level evidence.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Approved drug</th>
                    <th>Rows</th>
                    <th>Max support</th>
                    <th>Max votes</th>
                    <th>Top TXGNN</th>
                    <th>Best ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedDrugDeepResults.length ? approvedDrugDeepResults.map((item) => (
                    <tr key={item.drug_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}>
                          <span className="result-emphasis-label">{item.drug_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3</span></td>
                      <td><span className="result-emphasis-chip is-soft">{item.max_votes}/7</span></td>
                      <td><span className="result-emphasis-number">{item.top_txgnn_score ?? "-"}</span></td>
                      <td>{item.best_enr_fdr != null ? <span className="result-emphasis-chip is-soft">{item.best_enr_fdr}</span> : "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}>No approved-drug result rows are available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Consensus Priority Table</h3>
              <div className="home-panel-subtitle">Top released rows ranked by joint support strength, seven-model votes, TXGNN score, and ENR significance.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>Support</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {topConsensusLeaderboard.length ? topConsensusLeaderboard.map((item, idx) => (
                    <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>{item.target_label}</button></td>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>{item.disease_label}</button></td>
                      <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                      <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                      <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                    </tr>
                  )) : <tr><td colSpan={6}>No consensus priority rows are available in the current release.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Approved Drug Priority Table</h3>
              <div className="home-panel-subtitle">Best supported released rows among approved drugs from the validation cohort.</div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>Support</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {topApprovedLeaderboard.length ? topApprovedLeaderboard.map((item, idx) => (
                    <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>{item.target_label}</button></td>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>{item.disease_label}</button></td>
                      <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                      <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                      <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                    </tr>
                  )) : <tr><td colSpan={6}>No approved priority rows are available in the current release.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Selected Prediction Results</h3>
              <div className="home-panel-subtitle">Released examples ranked by retained-method support, 7-model vote support, graph score, and enrichment evidence.</div>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{representativeCases.length}</strong>
                <em>Selected released cases</em>
              </span>
              <span className="result-summary-pill">
                <strong>{predictionResultTotal}</strong>
                <em>Total released prediction rows</em>
              </span>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Drug</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>Gene</th>
                    <th>Support</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {representativeCases.length ? representativeCases.map((item, idx) => (
                    <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}>
                          <span className="result-emphasis-label">{item.drug_label}</span>
                        </button>{" "}
                        <span className="result-id-chip">{item.drug_id}</span>
                      </td>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>
                          {item.target_label}
                        </button>
                      </td>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>
                          {item.disease_label}
                        </button>
                      </td>
                      <td>{item.gene_name}</td>
                      <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                      <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                      <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7}>No representative prediction cases are available in the current release.</td>
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
