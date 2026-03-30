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

export default function DatabasePage({
  nodesState,
  edgesState,
  predictionState,
  researchSummary,
  nodeFilters,
  edgeFilters,
  predictionFilters,
  onNodeFiltersChange,
  onEdgeFiltersChange,
  onPredictionFiltersChange,
  onNodeSearch,
  onEdgeSearch,
  onPredictionSearch,
  onNodePage,
  onEdgePage,
  onPredictionPage,
  onJumpToNode,
  onExportNodes,
  onExportEdges,
  onExportPredictions,
  onExportConsensusResults,
  onExportApprovedResults,
  onExportDiseaseResults,
  canNodePrev,
  canNodeNext,
  canEdgePrev,
  canEdgeNext,
  canPredictionPrev,
  canPredictionNext
}) {
  const [selectedPrediction, setSelectedPrediction] = React.useState(null);
  const [predictionSort, setPredictionSort] = React.useState({ key: "result_rank", direction: "asc" });
  const nodeTypeCounts = nodesState.items.reduce((acc, n) => {
    const key = n.node_type || "Other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const edgeTypeClass = (value) => {
    if (value === "Known") return "is-known";
    if (value === "Predicted") return "is-predicted";
    if (value === "Known+Predicted") return "is-kp";
    return "";
  };
  const passFlag = (value) => {
    const normalized = String(value ?? "0");
    return normalized === "1" || normalized.toLowerCase() === "true";
  };
  const renderMethodBadge = (label, value) => (
    <span className={`algo-chip ${passFlag(value) ? "is-on" : "is-off"}`}>{label}</span>
  );
  const renderSevenModelBadges = (row) => {
    const supporting = new Set(row?.seven_model_supporting_models || []);
    const scores = row?.seven_model_scores || {};
    return SEVEN_DTI_MODEL_META.map((item) => (
      <span className={`algo-chip model-${item.key} ${supporting.has(item.label) || scores[item.label] != null ? "is-on" : "is-off"}`} key={item.label}>
        {item.label}
      </span>
    ));
  };
  const renderSevenModelHoverPanel = (row) => {
    const supporting = new Set(row?.seven_model_supporting_models || []);
    const scores = row?.seven_model_scores || {};
    return (
      <div className="seven-model-hover-panel">
        <div className="seven-model-hover-title">Seven-model DTI scores</div>
        <div className="seven-model-hover-subtitle">The same atlas palette and model order are used across the homepage and analysis view.</div>
        <div className="seven-model-hover-grid">
          {SEVEN_DTI_MODEL_META.map((item) => {
            const score = scores[item.label];
            const isOn = supporting.has(item.label) || score != null;
            return (
              <div className={`seven-model-hover-card model-${item.key} ${isOn ? "is-on" : "is-off"}`} key={item.label}>
                <strong>{item.label}</strong>
                <span>{score != null ? score : "-"}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderCoreSupportMeter = (value) => {
    const count = Number(value || 0);
    return (
      <div className="support-meter">
        <span className={`support-dot ${count >= 1 ? "is-on" : ""}`} />
        <span className={`support-dot ${count >= 2 ? "is-on" : ""}`} />
        <span className={`support-dot ${count >= 3 ? "is-on" : ""}`} />
        <strong>{count}/3</strong>
      </div>
    );
  };
  const renderVoteMeter = (value) => {
    const count = Number(value || 0);
    const pct = Math.max(0, Math.min(100, (count / 7) * 100));
    return (
      <div className="vote-meter">
        <div className="vote-meter-bar"><i style={{ width: `${pct}%` }} /></div>
        <strong>{count}/7</strong>
      </div>
    );
  };
  const sourceTables = researchSummary?.source_tables || [];
  const predictionSummary = researchSummary?.prediction_summary || null;
  const algoDistribution = predictionSummary?.algorithm_support_distribution || [];
  const voteDistribution = predictionSummary?.vote_distribution || [];
  const dtiModelConsistency = predictionSummary?.dti_model_consistency || null;
  const dtiModelCoverage = dtiModelConsistency?.model_coverage || [];
  const dtiTopPairs = dtiModelConsistency?.top_pairs || [];
  const dtiTopPatterns = dtiModelConsistency?.top_patterns || [];
  const dtiHeatmap = React.useMemo(() => buildDtiHeatmap(dtiModelCoverage, dtiTopPairs), [dtiModelCoverage, dtiTopPairs]);
  const diseaseDistribution = researchSummary?.disease_distribution?.top_diseases || [];
  const drugDistribution = researchSummary?.drug_distribution?.top_drugs || [];
  const targetDistribution = researchSummary?.target_distribution?.top_targets || [];
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
  const representativeDrugCount = representativeDrugs.length;
  const topDiseaseShare = diseaseDistribution[0]?.share_pct ?? null;
  const sortIcon = (key) => {
    if (predictionSort.key !== key) return "↕";
    return predictionSort.direction === "asc" ? "↑" : "↓";
  };
  const togglePredictionSort = (key) => {
    setPredictionSort((prev) => (
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "ENR_FDR" ? "asc" : "desc" }
    ));
  };
  const sortedPredictionItems = React.useMemo(() => {
    const items = [...(predictionState.items || [])];
    const { key, direction } = predictionSort;
    const dir = direction === "asc" ? 1 : -1;
    const numKeys = new Set(["result_rank", "n_algo_pass", "Total_Votes_Optional7", "TXGNN_score", "ENR_FDR"]);
    items.sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (numKeys.has(key)) {
        const an = Number(av ?? Number.NEGATIVE_INFINITY);
        const bn = Number(bv ?? Number.NEGATIVE_INFINITY);
        return (an - bn) * dir;
      }
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
    return items;
  }, [predictionState.items, predictionSort]);
  const methodRows = [
    {
      method: "TXGNN",
      role: "Graph-based prediction score",
      keyFields: "TXGNN_pass, TXGNN_score",
      interpretation: "Higher graph score and pass status increase retained confidence."
    },
    {
      method: "ENR",
      role: "Enrichment significance support",
      keyFields: "ENR_pass, ENR_FDR",
      interpretation: "Lower FDR with pass status strengthens disease-level evidence."
    },
    {
      method: "RWR",
      role: "Random walk propagation support",
      keyFields: "RWR_pass",
      interpretation: "Propagation support contributes to multi-method agreement."
    }
  ];

  React.useEffect(() => {
    if (!predictionState.items?.length) {
      setSelectedPrediction(null);
      return;
    }
    if (!selectedPrediction) {
      setSelectedPrediction(predictionState.items[0]);
      return;
    }
    const stillVisible = predictionState.items.some(
      (row) =>
        row.Drug_ID === selectedPrediction.Drug_ID &&
        row.Target_ID === selectedPrediction.Target_ID &&
        (row.Disease_ID || `DIS::${row.Ensemble_Disease_Name}`) ===
          (selectedPrediction.Disease_ID || `DIS::${selectedPrediction.Ensemble_Disease_Name}`)
    );
    if (!stillVisible) {
      setSelectedPrediction(predictionState.items[0]);
    }
  }, [predictionState.items, selectedPrediction]);

  return (
    <section className="page is-active db-page">
      <div className="analysis-header page-head">
        <div>
          <h2>Database Tables</h2>
          <div className="analysis-subtitle">Structured access to released node, edge, and prediction-result tables in the curated DTD atlas.</div>
        </div>
        <div className="toolbar">
          <button className="btn-quiet" onClick={onExportNodes}>Export Nodes</button>
          <button className="primary" onClick={onExportEdges}>Export Edges</button>
        </div>
      </div>

      <section className="card db-query-deck">
        <div className="db-query-grid">
          <div className="db-query-block">
            <div className="db-query-label">Node Query</div>
            <div className="inline-filters db-filters db-filters-top">
              <input
                placeholder="Search a drug, target, or disease record..."
                value={nodeFilters.q}
                onChange={(e) => onNodeFiltersChange({ q: e.target.value })}
              />
              <select
                value={nodeFilters.node_type}
                onChange={(e) => onNodeFiltersChange({ node_type: e.target.value })}
              >
                <option value="">All node types</option>
                <option value="Drug">Drug</option>
                <option value="Target">Target</option>
                <option value="Disease">Disease</option>
              </select>
              <button onClick={onNodeSearch}>Search Records</button>
            </div>
          </div>
          <div className="db-query-block">
            <div className="db-query-label">Edge Query</div>
            <div className="inline-filters edge db-filters db-filters-top">
              <input
                placeholder="Search by source, target, or annotation remark..."
                value={edgeFilters.q}
                onChange={(e) => onEdgeFiltersChange({ q: e.target.value })}
              />
              <select
                value={edgeFilters.edge_category}
                onChange={(e) => onEdgeFiltersChange({ edge_category: e.target.value })}
              >
                <option value="">All categories</option>
                <option value="Drug-Target">Drug-Target</option>
                <option value="Drug-Disease">Drug-Disease</option>
                <option value="Target-Disease">Target-Disease</option>
              </select>
              <select
                value={edgeFilters.edge_type}
                onChange={(e) => onEdgeFiltersChange({ edge_type: e.target.value })}
              >
                <option value="">All types</option>
                <option value="Known">Known</option>
                <option value="Predicted">Predicted</option>
                <option value="Known+Predicted">Known+Predicted</option>
              </select>
              <button onClick={onEdgeSearch}>Search Relationships</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card db-query-deck">
        <div className="db-query-grid">
          <div className="db-query-block">
            <div className="db-query-label">Prediction Result Query</div>
            <div className="inline-filters edge db-filters db-filters-top prediction-filters">
              <input
                placeholder="Search by drug, target, disease, or gene symbol..."
                value={predictionFilters.q}
                onChange={(e) => onPredictionFiltersChange({ q: e.target.value })}
              />
              <select
                value={predictionFilters.n_algo_pass}
                onChange={(e) => onPredictionFiltersChange({ n_algo_pass: e.target.value })}
              >
                <option value="">All algorithm supports</option>
                <option value="1">n_algo_pass = 1</option>
                <option value="2">n_algo_pass = 2</option>
                <option value="3">n_algo_pass = 3</option>
              </select>
              <select
                value={predictionFilters.txgnn_pass}
                onChange={(e) => onPredictionFiltersChange({ txgnn_pass: e.target.value })}
              >
                <option value="">TXGNN all</option>
                <option value="1">TXGNN pass</option>
                <option value="0">TXGNN fail</option>
              </select>
              <select
                value={predictionFilters.enr_pass}
                onChange={(e) => onPredictionFiltersChange({ enr_pass: e.target.value })}
              >
                <option value="">ENR all</option>
                <option value="1">ENR pass</option>
                <option value="0">ENR fail</option>
              </select>
              <select
                value={predictionFilters.rwr_pass}
                onChange={(e) => onPredictionFiltersChange({ rwr_pass: e.target.value })}
              >
                <option value="">RWR all</option>
                <option value="1">RWR pass</option>
                <option value="0">RWR fail</option>
              </select>
              <button onClick={onPredictionSearch}>Search Prediction Results</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card panel-pad db-research-panel">
        <div className="db-panel-head">
          <div>
            <h3>Research Result Overview</h3>
          <div className="db-panel-subtitle">Release statistics, source-table inventory, and structured result summaries for the current atlas version.</div>
          </div>
        </div>
        <div className="db-research-grid">
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Algorithm metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {predictionSummary ? (
                  <>
                    <tr><td>Prediction rows</td><td>{predictionSummary.total_rows}</td></tr>
                    <tr><td>TXGNN pass</td><td>{predictionSummary.txgnn_pass}</td></tr>
                    <tr><td>ENR pass</td><td>{predictionSummary.enr_pass}</td></tr>
                    <tr><td>RWR pass</td><td>{predictionSummary.rwr_pass}</td></tr>
                  </>
                ) : (
                  <tr><td colSpan={2}>No algorithm summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Source dataset</th>
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
        </div>
        <div className="result-summary-strip db-result-summary">
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
            <strong>{sourceTables.length}</strong>
            <em>Source datasets</em>
          </span>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>DTI model</th>
                  <th>Released rows</th>
                  <th>Share</th>
                  <th>Avg score</th>
                </tr>
              </thead>
              <tbody>
                {dtiModelCoverage.length ? dtiModelCoverage.map((item) => (
                  <tr key={item.model}>
                    <td><span className="result-emphasis-label">{item.model}</span></td>
                    <td><span className="result-emphasis-number">{item.count}</span></td>
                    <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                    <td>{item.avg_score ?? "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4}>No seven-model consistency summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Top DTI pair</th>
                  <th>Rows</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {dtiTopPairs.length ? dtiTopPairs.map((item) => (
                  <tr key={item.pair_label}>
                    <td>{item.pair_label}</td>
                    <td>{item.count}</td>
                    <td>{item.share_pct}%</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}>No DTI pair consistency summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>DTI co-support heatmap</strong>
              <span>Diagonal cells show per-model coverage; off-diagonal cells show the strongest pairwise co-support counts among released rows.</span>
            </div>
            <div className="dti-heatmap-grid" style={{ gridTemplateColumns: `120px repeat(${dtiHeatmap.labels.length}, minmax(0, 1fr))` }}>
              <div className="dti-heatmap-corner" />
              {dtiHeatmap.labels.map((label) => (
                <div className="dti-heatmap-axis" key={`db-col-${label}`}>{label}</div>
              ))}
              {dtiHeatmap.rows.map((row) => (
                <React.Fragment key={`db-${row.rowLabel}`}>
                  <div className="dti-heatmap-axis is-row">{row.rowLabel}</div>
                  {row.cells.map((cell) => {
                    const meta = SEVEN_DTI_MODEL_META.find((item) => item.label === cell.colLabel) || SEVEN_DTI_MODEL_META[0];
                    return (
                      <div
                        key={`db-${cell.rowLabel}-${cell.colLabel}`}
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
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Top seven-model pattern</th>
                  <th>Rows</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {dtiTopPatterns.length ? dtiTopPatterns.map((item) => (
                  <tr key={item.pattern_label}>
                    <td>{item.pattern_label}</td>
                    <td>{item.count}</td>
                    <td>{item.share_pct}%</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}>No DTI support-pattern summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Pipeline stage</th>
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
                  <tr><td colSpan={2}>No pipeline shrinkage summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
                  <tr><td colSpan={3}>No released-support tier overview is available.</td></tr>
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
                  <tr><td colSpan={3}>No seven-model support-tier overview is available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Disease summary</th>
                  <th>Rows</th>
                  <th>Top drug</th>
                  <th>Top target</th>
                  <th>Best support</th>
                </tr>
              </thead>
              <tbody>
                {diseaseSpotlights.length ? diseaseSpotlights.map((item) => (
                  <tr key={item.disease_id}>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}><span className="result-emphasis-label">{item.disease_label}</span></button></td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td>{item.top_drug_label || "-"}</td>
                    <td>{item.top_target_label || "-"}</td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}>No disease summary rows are available in the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>Released-method consistency</strong>
              <span>The released atlas retains rows through TXGNN, ENR, and RWR agreement patterns.</span>
            </div>
            <div className="model-overview-strip">
              <div className="model-overview-bar" aria-label="Released-method support distribution">
                {(predictionSummary?.support_pattern_distribution || []).length ? (
                  (() => {
                    const rows = (predictionSummary?.support_pattern_distribution || []).reduce((acc, item) => {
                      acc[item.support_pattern_label] = item.count;
                      return acc;
                    }, {});
                    const parts = [
                      { key: "txgnn_only", label: "TXGNN-only", colorClass: "is-txgnn", value: rows["TXGNN only"] || 0 },
                      { key: "enr_only", label: "ENR-only", colorClass: "is-enr", value: rows["ENR only"] || 0 },
                      { key: "rwr_only", label: "RWR-only", colorClass: "is-rwr", value: rows["RWR only"] || 0 },
                      {
                        key: "consensus",
                        label: "Consensus",
                        colorClass: "is-consensus",
                        value:
                          (rows["TXGNN + ENR + RWR"] || 0) +
                          (rows["TXGNN + ENR"] || 0) +
                          (rows["TXGNN + RWR"] || 0) +
                          (rows["ENR + RWR"] || 0),
                      },
                    ];
                    const total = parts.reduce((sum, item) => sum + item.value, 0);
                    return parts.map((item) => (
                      <span
                        key={`db-release-${item.key}`}
                        className={`model-overview-segment ${item.colorClass}`}
                        style={{ width: total ? `${(item.value / total) * 100}%` : "0%" }}
                      />
                    ));
                  })()
                ) : null}
              </div>
            </div>
          </div>
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>Seven-model DTI consistency</strong>
              <span>The upstream DTI layer exposes which models most often co-support the released prediction rows.</span>
            </div>
            <div className="dti-heatmap-grid" style={{ gridTemplateColumns: `120px repeat(${dtiHeatmap.labels.length}, minmax(0, 1fr))` }}>
              <div className="dti-heatmap-corner" />
              {dtiHeatmap.labels.map((label) => (
                <div className="dti-heatmap-axis" key={`db-compare-col-${label}`}>{label}</div>
              ))}
              {dtiHeatmap.rows.map((row) => (
                <React.Fragment key={`db-compare-${row.rowLabel}`}>
                  <div className="dti-heatmap-axis is-row">{row.rowLabel}</div>
                  {row.cells.map((cell) => {
                    const meta = SEVEN_DTI_MODEL_META.find((item) => item.label === cell.colLabel) || SEVEN_DTI_MODEL_META[0];
                    return (
                      <div
                        key={`db-compare-${cell.rowLabel}-${cell.colLabel}`}
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
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Approved-drug validation metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {approvedValidation ? (
                  <>
                    <tr><td>Approved drugs in DrugBank</td><td>{approvedValidation.approved_total}</td></tr>
                    <tr><td>Entered DTI model space</td><td>{approvedValidation.entered_dti_space}</td></tr>
                    <tr><td>Entered high-confidence candidate set</td><td>{approvedValidation.entered_high_confidence}</td></tr>
                    <tr><td>Retained in final network</td><td>{approvedValidation.retained_final}</td></tr>
                    <tr><td>Final retention rate</td><td>{approvedValidation.final_retention_pct}%</td></tr>
                    <tr><td>Approved mean TXGNN score</td><td>{approvedValidation.approved_mean_txgnn}</td></tr>
                    <tr><td>Non-approved mean TXGNN score</td><td>{approvedValidation.nonapproved_mean_txgnn}</td></tr>
                    <tr><td>Mann-Whitney U p-value</td><td>{approvedValidation.mann_whitney_p}</td></tr>
                    <tr><td>Cohen's d</td><td>{approvedValidation.cohens_d}</td></tr>
                  </>
                ) : (
                  <tr><td colSpan={2}>No approved-drug validation summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
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
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Role</th>
                  <th>Key fields</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {methodRows.map((row) => (
                  <tr key={row.method}>
                    <td>{row.method}</td>
                    <td>{row.role}</td>
                    <td>{row.keyFields}</td>
                    <td>{row.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Top drug</th>
                  <th>Rows</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {drugDistribution.length ? drugDistribution.map((item) => (
                  <tr key={item.drug_id}>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}>
                        <span className="result-emphasis-label">{item.drug_label}</span>
                      </button>
                    </td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}>No drug-level distribution is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Top target</th>
                  <th>Rows</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {targetDistribution.length ? targetDistribution.map((item) => (
                  <tr key={item.target_id}>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>
                        <span className="result-emphasis-label">{item.target_label}</span>
                      </button>
                    </td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}>No target-level distribution is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table compact">
              <thead>
                <tr>
                  <th>Top disease</th>
                  <th>Edges</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {diseaseDistribution.length ? diseaseDistribution.map((item) => (
                  <tr key={item.disease_id}>
                    <td><span className="result-emphasis-label">{item.disease_label}</span></td>
                    <td><span className="result-emphasis-number">{item.edge_count}</span></td>
                    <td><span className="result-emphasis-chip">{item.share_pct}%</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}>No disease-distribution summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Selected clinical drug</th>
                  <th>Leading disease</th>
                  <th>TXGNN score</th>
                  <th>ENR FDR</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {representativeDrugs.length ? representativeDrugs.map((item) => (
                  <tr key={item.drug_id}>
                    <td><span className="result-emphasis-label">{item.drug_label}</span> <span className="muted">({item.drug_id})</span></td>
                    <td>{item.disease_label || "Retained in atlas"}</td>
                    <td><span className="result-emphasis-number">{item.txgnn_score ?? "-"}</span></td>
                    <td>{item.enr_fdr != null ? <span className="result-emphasis-chip is-soft">{item.enr_fdr}</span> : "-"}</td>
                    <td>{item.n_algo_pass != null ? <span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.seven_model_votes}/7</span> : "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}>No representative-drug summary is available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
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
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}>
                        <span className="result-emphasis-label">{item.drug_label}</span>
                      </button>
                    </td>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>
                        {item.target_label}
                      </button>
                    </td>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>
                        {item.disease_label}
                      </button>
                    </td>
                    <td>{item.gene_name}</td>
                    <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                    <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                    <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7}>No representative prediction cases are available for the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>High-consensus case</th>
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
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}>
                        <span className="result-emphasis-label">{item.drug_label}</span>
                      </button>
                    </td>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>
                        {item.target_label}
                      </button>
                    </td>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>
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
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Disease</th>
                  <th>Released rows</th>
                  <th>Max support</th>
                  <th>Max 7-model votes</th>
                  <th>Top TXGNN score</th>
                  <th>Best ENR FDR</th>
                </tr>
              </thead>
              <tbody>
                {diseaseResults.length ? diseaseResults.map((item) => (
                  <tr key={item.disease_id}>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>
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
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Approved drug</th>
                  <th>Released rows</th>
                  <th>Max support</th>
                  <th>Max 7-model votes</th>
                  <th>Top TXGNN score</th>
                  <th>Best ENR FDR</th>
                </tr>
              </thead>
              <tbody>
                {approvedDrugDeepResults.length ? approvedDrugDeepResults.map((item) => (
                  <tr key={item.drug_id}>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}>
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
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Drug summary</th>
                  <th>Rows</th>
                  <th>Top disease</th>
                  <th>Top target</th>
                  <th>Best support</th>
                </tr>
              </thead>
              <tbody>
                {drugSpotlights.length ? drugSpotlights.map((item) => (
                  <tr key={item.drug_id}>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td>{item.top_disease_label || "-"}</td>
                    <td>{item.top_target_label || "-"}</td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                  </tr>
                )) : <tr><td colSpan={5}>No drug summary rows are available in the current release.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Target summary</th>
                  <th>Rows</th>
                  <th>Top disease</th>
                  <th>Top drug</th>
                  <th>Best support</th>
                </tr>
              </thead>
              <tbody>
                {targetSpotlights.length ? targetSpotlights.map((item) => (
                  <tr key={item.target_id}>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}><span className="result-emphasis-label">{item.target_label}</span></button></td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td>{item.top_disease_label || "-"}</td>
                    <td>{item.top_drug_label || "-"}</td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                  </tr>
                )) : <tr><td colSpan={5}>No target summary rows are available in the current release.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Consensus priority</th>
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
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>{item.target_label}</button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>{item.disease_label}</button></td>
                    <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                    <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                    <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                  </tr>
                )) : <tr><td colSpan={6}>No consensus priority rows are available in the current release.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Approved priority</th>
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
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>{item.target_label}</button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>{item.disease_label}</button></td>
                    <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                    <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                    <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                  </tr>
                )) : <tr><td colSpan={6}>No approved priority rows are available in the current release.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="db-summary">
        <div className="kpi-card">
          <div className="kpi-label">Nodes In Page</div>
          <div className="kpi-value">{nodesState.items.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Edges In Page</div>
          <div className="kpi-value">{edgesState.items.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Node Mix</div>
          <div className="kpi-value kpi-split">{nodeTypeCounts.Drug || 0} / {nodeTypeCounts.Target || 0} / {nodeTypeCounts.Disease || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Filtered Totals</div>
          <div className="kpi-value kpi-split">{nodesState.total} nodes · {edgesState.total} edges</div>
        </div>
      </div>

      <div className="db-layout">
        <section className="card panel-pad db-panel">
          <div className="db-panel-head">
            <div>
              <h3>Node Table</h3>
              <div className="db-panel-subtitle">Search and review drug, target, and disease entries in the current network release.</div>
            </div>
            <div className="muted">page {nodesState.page} · size {nodesState.page_size} · total {nodesState.total}</div>
          </div>
          <div className="list">
            {nodesState.items.length ? nodesState.items.map((n) => (
              <div className="item db-item" key={n.id} onClick={() => onJumpToNode(n.id)}>
                <div className="db-item-top">
                  <div className="item-title">{n.display_name || n.label}</div>
                  <span className={`db-badge type-${String(n.node_type || "").toLowerCase()}`}>{n.node_type}</span>
                </div>
                <div className="item-meta">{n.id}</div>
              </div>
            )) : <div className="empty-state">No node records matched the current filters.</div>}
          </div>
          <div className="pager">
            <button onClick={() => onNodePage(-1)} disabled={!canNodePrev}>Previous</button>
            <span className="pager-status">Page {nodesState.page}</span>
            <button onClick={() => onNodePage(1)} disabled={!canNodeNext}>Next Page</button>
          </div>
        </section>

        <section className="card panel-pad db-panel">
          <div className="db-panel-head">
            <div>
              <h3>Relationship Table</h3>
              <div className="db-panel-subtitle">Review relationship category, evidence class, and support metrics in a unified list.</div>
            </div>
            <div className="muted">page {edgesState.page} · size {edgesState.page_size} · total {edgesState.total}</div>
          </div>
          <div className="result-table-wrap edge-result-wrap">
            {edgesState.items.length ? (
              <table className="result-table edge-result-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Target</th>
                    <th>Category</th>
                    <th>Evidence</th>
                    <th>Score</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {edgesState.items.map((e, idx) => (
                    <tr key={`${e.source}-${e.target}-${e.edge_category}-${idx}`} onClick={() => onJumpToNode(e.source)}>
                      <td>{e.source_label || e.source}</td>
                      <td>{e.target_label || e.target}</td>
                      <td><span className="db-meta-pill">{e.edge_category}</span></td>
                      <td><span className={`db-badge ${edgeTypeClass(e.edge_type)}`}>{e.edge_type}</span></td>
                      <td>{e.support_score ?? "NA"}</td>
                      <td>{e.remark || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-state">No relationship records matched the current filters.</div>}
          </div>
          <div className="pager">
            <button onClick={() => onEdgePage(-1)} disabled={!canEdgePrev}>Previous</button>
            <span className="pager-status">Page {edgesState.page}</span>
            <button onClick={() => onEdgePage(1)} disabled={!canEdgeNext}>Next Page</button>
          </div>
        </section>
      </div>

      <section className="card panel-pad db-panel db-stack-gap">
        <div className="db-panel-head">
          <div>
            <h3>Prediction Result Table</h3>
            <div className="db-panel-subtitle">Drug-target-disease prediction results with identifiers, ranks, vote counts, and method-specific evidence fields.</div>
          </div>
          <div className="db-panel-actions">
            <div className="muted">page {predictionState.page} · size {predictionState.page_size} · total {predictionState.total}</div>
            <button className="btn-quiet" onClick={onExportPredictions}>Export Prediction Table</button>
          </div>
        </div>
        <div className="result-summary-strip db-result-summary">
          <span className="result-summary-pill">
            <strong>{predictionState.total}</strong>
            <em>Released prediction records</em>
          </span>
          {predictionSummary ? (
            <span className="result-summary-pill">
              <strong>{predictionSummary.txgnn_pass}/{predictionSummary.enr_pass}/{predictionSummary.rwr_pass}</strong>
              <em>TXGNN / ENR / RWR support counts</em>
            </span>
          ) : null}
          {topDiseaseShare != null ? (
            <span className="result-summary-pill">
              <strong>{topDiseaseShare}%</strong>
              <em>Top disease share</em>
            </span>
          ) : null}
          {representativeDrugCount ? (
            <span className="result-summary-pill">
              <strong>{representativeDrugCount}</strong>
              <em>Selected clinical drugs</em>
            </span>
          ) : null}
          {highConsensusCases.length ? (
            <span className="result-summary-pill">
              <strong>{highConsensusCases.length}</strong>
              <em>High-consensus results</em>
            </span>
          ) : null}
        </div>
        <div className="toolbar toolbar-wrap">
          <button className="btn-quiet" onClick={onExportConsensusResults}>Export Consensus-only Results</button>
          <button className="btn-quiet" onClick={onExportApprovedResults}>Export Approved-related Results</button>
          <button className="btn-quiet" onClick={onExportDiseaseResults}>Export Disease Result Table</button>
        </div>
        <div className="result-table-wrap edge-result-wrap">
          {predictionState.items.length ? (
            <table className="result-table edge-result-table prediction-result-table">
              <thead>
                <tr>
                  <th><button className="table-sort-btn" onClick={() => togglePredictionSort("result_rank")}>Rank {sortIcon("result_rank")}</button></th>
                  <th><button className="table-sort-btn" onClick={() => togglePredictionSort("Drug_Label")}>Drug {sortIcon("Drug_Label")}</button></th>
                  <th>Drug ID</th>
                    <th><button className="table-sort-btn" onClick={() => togglePredictionSort("Target_Label")}>Target {sortIcon("Target_Label")}</button></th>
                    <th>Target ID</th>
                    <th><button className="table-sort-btn" onClick={() => togglePredictionSort("Disease_Label")}>Disease {sortIcon("Disease_Label")}</button></th>
                    <th>Disease ID</th>
                    <th>Gene</th>
                    <th><button className="table-sort-btn" onClick={() => togglePredictionSort("n_algo_pass")}>Retained methods {sortIcon("n_algo_pass")}</button></th>
                    <th><button className="table-sort-btn" onClick={() => togglePredictionSort("Total_Votes_Optional7")}>7-model votes {sortIcon("Total_Votes_Optional7")}</button></th>
                  <th>Core evidence</th>
                  <th>7 DTI models</th>
                  <th><button className="table-sort-btn" onClick={() => togglePredictionSort("TXGNN_score")}>TXGNN score {sortIcon("TXGNN_score")}</button></th>
                  <th><button className="table-sort-btn" onClick={() => togglePredictionSort("ENR_FDR")}>ENR FDR {sortIcon("ENR_FDR")}</button></th>
                  <th>Support pattern</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {sortedPredictionItems.map((row, idx) => (
                  <tr
                    key={`${row.Drug_ID}-${row.Target_ID}-${row.Ensemble_Disease_Name}-${idx}`}
                    onClick={() => setSelectedPrediction(row)}
                    className={selectedPrediction?.Drug_ID === row.Drug_ID && selectedPrediction?.Target_ID === row.Target_ID && selectedPrediction?.Disease_ID === row.Disease_ID ? "is-row-selected" : ""}
                  >
                    <td>{row.result_rank ?? "-"}</td>
                    <td>{row.Drug_Label || row.Drug_Name || row.Drug_ID}</td>
                    <td>{row.Drug_ID}</td>
                    <td>{row.Target_Label || row.Target_Name || row.Target_ID}</td>
                    <td>{row.Target_ID}</td>
                    <td>{row.Disease_Label || row.Ensemble_Disease_Name}</td>
                    <td>{row.Disease_ID || `DIS::${row.Ensemble_Disease_Name}`}</td>
                    <td>{row.gene_name || "-"}</td>
                    <td>{renderCoreSupportMeter(row.n_algo_pass)}</td>
                    <td>{renderVoteMeter(row.Total_Votes_Optional7)}</td>
                    <td>
                      <div className="algo-chip-row">
                        {renderMethodBadge("TXGNN", row.TXGNN_pass)}
                        {renderMethodBadge("ENR", row.ENR_pass)}
                        {renderMethodBadge("RWR", row.RWR_pass)}
                      </div>
                    </td>
                    <td>
                      <div className="algo-chip-row has-hover-panel">
                        {renderSevenModelBadges(row)}
                        {renderSevenModelHoverPanel(row)}
                      </div>
                    </td>
                    <td>{row.TXGNN_score ?? "-"}</td>
                    <td>{row.ENR_FDR ?? "-"}</td>
                    <td>{row.support_pattern || "-"}</td>
                    <td>{row.source_table || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-state">No prediction records matched the current filters.</div>}
        </div>
        <div className="pager">
          <button onClick={() => onPredictionPage(-1)} disabled={!canPredictionPrev}>Previous</button>
          <span className="pager-status">Page {predictionState.page}</span>
          <button onClick={() => onPredictionPage(1)} disabled={!canPredictionNext}>Next Page</button>
        </div>

        <div className="prediction-detail-card">
          {selectedPrediction ? (
            <>
              <div className="prediction-detail-head">
                <div>
                  <h4>Selected Prediction Record</h4>
                  <div className="db-panel-subtitle">Detailed algorithm fields and direct navigation targets for the selected row.</div>
                </div>
                <div className="prediction-detail-actions">
                  <button className="btn-quiet" onClick={() => onJumpToNode(selectedPrediction.Drug_ID)}>View Drug</button>
                  <button className="btn-quiet" onClick={() => onJumpToNode(selectedPrediction.Target_ID)}>View Target</button>
                  <button className="btn-quiet" onClick={() => onJumpToNode(selectedPrediction.Disease_ID || `DIS::${selectedPrediction.Ensemble_Disease_Name}`)}>View Disease</button>
                </div>
              </div>
              <div className="prediction-detail-grid">
                <div className="prediction-metric">
                  <span>Drug</span>
                  <strong>{selectedPrediction.Drug_Label || selectedPrediction.Drug_ID}</strong>
                  <small>{selectedPrediction.Drug_ID}</small>
                </div>
                <div className="prediction-metric">
                  <span>Target</span>
                  <strong>{selectedPrediction.Target_Label || selectedPrediction.Target_ID}</strong>
                  <small>{selectedPrediction.Target_ID}</small>
                </div>
                <div className="prediction-metric">
                  <span>Disease</span>
                  <strong>{selectedPrediction.Disease_Label || selectedPrediction.Ensemble_Disease_Name}</strong>
                  <small>{selectedPrediction.Disease_ID || `DIS::${selectedPrediction.Ensemble_Disease_Name}`}</small>
                </div>
                <div className="prediction-metric">
                  <span>Gene</span>
                  <strong>{selectedPrediction.gene_name || "-"}</strong>
                </div>
                <div className="prediction-metric">
                  <span>Rank</span>
                  <strong>{selectedPrediction.result_rank ?? "-"}</strong>
                </div>
                <div className="prediction-metric">
                  <span>Retained methods</span>
                  <strong>{selectedPrediction.n_algo_pass ?? "-"} / 3</strong>
                  <small>Released method support</small>
                </div>
                <div className="prediction-metric">
                  <span>7-model votes</span>
                  <strong>{selectedPrediction.Total_Votes_Optional7 ?? "-"} / 7</strong>
                  <small>Optional DTI-model support</small>
                </div>
                <div className="prediction-metric">
                  <span>TXGNN score</span>
                  <strong>{selectedPrediction.TXGNN_score ?? "-"}</strong>
                </div>
                <div className="prediction-metric">
                  <span>ENR FDR</span>
                  <strong>{selectedPrediction.ENR_FDR ?? "-"}</strong>
                </div>
              </div>
              <div className="prediction-support-row">
                <span className={`prediction-support-chip ${passFlag(selectedPrediction.TXGNN_pass) ? "is-on" : "is-off"}`}>TXGNN {passFlag(selectedPrediction.TXGNN_pass) ? "Pass" : "Not passed"}</span>
                <span className={`prediction-support-chip ${passFlag(selectedPrediction.ENR_pass) ? "is-on" : "is-off"}`}>ENR {passFlag(selectedPrediction.ENR_pass) ? "Pass" : "Not passed"}</span>
                <span className={`prediction-support-chip ${passFlag(selectedPrediction.RWR_pass) ? "is-on" : "is-off"}`}>RWR {passFlag(selectedPrediction.RWR_pass) ? "Pass" : "Not passed"}</span>
                <span className="prediction-support-chip is-source">{selectedPrediction.source_table || "-"}</span>
              </div>
              <div className="support-meter-row">
                <div className="support-meter-card">
                  <span>Released method support</span>
                  {renderCoreSupportMeter(selectedPrediction.n_algo_pass)}
                </div>
                <div className="support-meter-card">
                  <span>7-model vote support</span>
                  {renderVoteMeter(selectedPrediction.Total_Votes_Optional7)}
                </div>
              </div>
              <div className="prediction-support-pattern">Supporting DTI models: {(selectedPrediction.seven_model_supporting_models || []).join(", ") || "No per-model support list is available for this record"}</div>
              <div className="algo-evidence-grid compact">
                <div className={`algo-evidence-card ${passFlag(selectedPrediction.TXGNN_pass) ? "is-on" : "is-off"}`}>
                  <div className="algo-evidence-head"><span>TXGNN</span><strong>{passFlag(selectedPrediction.TXGNN_pass) ? "Pass" : "Not retained"}</strong></div>
                  <div className="algo-evidence-meta">Graph score</div>
                  <div className="algo-evidence-value">{selectedPrediction.TXGNN_score ?? "-"}</div>
                </div>
                <div className={`algo-evidence-card ${passFlag(selectedPrediction.ENR_pass) ? "is-on" : "is-off"}`}>
                  <div className="algo-evidence-head"><span>ENR</span><strong>{passFlag(selectedPrediction.ENR_pass) ? "Pass" : "Not retained"}</strong></div>
                  <div className="algo-evidence-meta">Enrichment FDR</div>
                  <div className="algo-evidence-value">{selectedPrediction.ENR_FDR ?? "-"}</div>
                </div>
                <div className={`algo-evidence-card ${passFlag(selectedPrediction.RWR_pass) ? "is-on" : "is-off"}`}>
                  <div className="algo-evidence-head"><span>RWR</span><strong>{passFlag(selectedPrediction.RWR_pass) ? "Pass" : "Not retained"}</strong></div>
                  <div className="algo-evidence-meta">Propagation support</div>
                  <div className="algo-evidence-value">{selectedPrediction.n_algo_pass ?? "-"}</div>
                </div>
                <div className="algo-evidence-card is-on">
                  <div className="algo-evidence-head"><span>7-model vote</span><strong>{selectedPrediction.Total_Votes_Optional7 ?? "-"}/7</strong></div>
                  <div className="algo-evidence-meta">Aggregate optional-model support</div>
                  <div className="algo-evidence-value">{selectedPrediction.support_pattern || "-"}</div>
                </div>
              </div>
              <div className="algo-evidence-grid compact seven-model-score-grid">
                {SEVEN_DTI_MODEL_META.map((item) => {
                  const score = selectedPrediction.seven_model_scores?.[item.label];
                  const supported = (selectedPrediction.seven_model_supporting_models || []).includes(item.label);
                  return (
                    <div className={`algo-evidence-card model-${item.key} ${score != null || supported ? "is-on" : "is-off"}`} key={item.label}>
                      <div className="algo-evidence-head"><span>{item.label}</span><strong>{score != null ? "Scored" : "NA"}</strong></div>
                      <div className="algo-evidence-meta">Raw DTI model output</div>
                      <div className="algo-evidence-value">{score != null ? score : "-"}</div>
                      <div className="algo-evidence-meta">{supported ? "Included in support list" : "Not listed for this row"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="prediction-support-pattern">{selectedPrediction.support_pattern || "-"}</div>
            </>
          ) : (
            <div className="empty-state">Select a prediction record to inspect algorithm fields and review the corresponding drug, target, or disease entry.</div>
          )}
        </div>
      </section>
    </section>
  );
}
