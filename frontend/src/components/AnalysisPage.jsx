import React from "react";
import GraphCanvas from "./GraphCanvas";

const SEVEN_DTI_MODEL_META = [
  { key: "graphdta", label: "GraphDTA" },
  { key: "dtiam", label: "DTIAM" },
  { key: "drugban", label: "DrugBAN" },
  { key: "deeppurpose", label: "DeepPurpose" },
  { key: "deepdtagen", label: "DeepDTAGen" },
  { key: "moltrans", label: "MolTrans" },
  { key: "conplex", label: "Conplex" },
];

const ONLINE_ANALYSIS_PRESETS = [
  {
    key: "broad",
    title: "Broad query",
    note: "Retain most released rows for an initial analytical pass.",
    patch: { min_algo_pass: 1, min_votes: 0, txgnn_pass: "", enr_pass: "", rwr_pass: "", limit: 20 },
  },
  {
    key: "balanced",
    title: "Balanced filter",
    note: "Prioritize rows with multi-method support and moderate DTI vote support.",
    patch: { min_algo_pass: 2, min_votes: 4, txgnn_pass: "", enr_pass: "", rwr_pass: "", limit: 12 },
  },
  {
    key: "consensus",
    title: "Consensus-only",
    note: "Restrict to rows retained by all released methods and strong seven-model support.",
    patch: { min_algo_pass: 3, min_votes: 4, txgnn_pass: "", enr_pass: "", rwr_pass: "", limit: 12 },
  },
  {
    key: "txgnn",
    title: "TXGNN-prioritized",
    note: "Prioritize rows explicitly supported by TXGNN while preserving vote filtering.",
    patch: { min_algo_pass: 1, min_votes: 3, txgnn_pass: "1", enr_pass: "", rwr_pass: "", limit: 12 },
  },
];

function renderEdgeStats(items) {
  if (!items?.length) return <div className="item muted">No edge statistics are available for the current record.</div>;
  return items.map((x) => (
    <div className="item" key={`${x.edge_category}-${x.edge_type}`}>
      <div className="item-title">{x.edge_category} / {x.edge_type}</div>
      <div className="item-meta">count={x.count}</div>
    </div>
  ));
}

export default function AnalysisPage({
  graph,
  centerNode,
  graphMeta,
  detail,
  neighborState,
  recentCenters,
  graphMode,
  graphSearchText,
  pathState,
  onlineAnalysisState,
  onlineAnalysisResult,
  onExportOnlineAnalysisResults,
  onLoadOnlineAnalysisSubgraph,
  onOpenOnlineAnalysisRow,
  compareState,
  onGraphSearchTextChange,
  onCenterNodeChange,
  onGraphModeChange,
  onPathStateChange,
  onOnlineAnalysisStateChange,
  onRunOnlineAnalysis,
  onCompareStateChange,
  onRunDrugCompare,
  onLoadCompareSubgraph,
  onCompareJump,
  onLoadGraph,
  onFindPath,
  onCompareModes,
  onFitGraph,
  onShareState,
  onExpandFromSelected,
  onResetFilters,
  onDenseGraph,
  onAllNetwork,
  onExportSubgraph,
  onNodeClick,
  onNodeDoubleClick,
  onRecentCenterClick,
  onNeighborQueryChange,
  onNeighborSearch,
  onNeighborPage,
  hoverState,
  onHoverNodeChange,
  fitSignal,
  graphLoading,
  controls,
  onControlsChange,
  densityMode,
  onDensityModeChange
}) {
  const [structureModalOpen, setStructureModalOpen] = React.useState(false);
  const [sequenceCopied, setSequenceCopied] = React.useState(false);
  const [resultSort, setResultSort] = React.useState({ key: "support_score", direction: "desc" });
  const { depth, limit, categories, types } = controls;

  const toggleArrValue = (arr, value) => (arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);

  const detailKey = detail?.node?.id || "empty";
  const statMap = (detail?.edge_stats || []).reduce((acc, x) => {
    acc[x.edge_type] = (acc[x.edge_type] || 0) + x.count;
    return acc;
  }, {});
  const knownCount = statMap.Known || 0;
  const predictedCount = statMap.Predicted || 0;
  const kpCount = statMap["Known+Predicted"] || 0;
  const ann = detail?.annotation || {};
  const profile = detail?.multimodal_profile || { modalities: [], available_modalities: 0, total_modalities: 0, coverage_ratio: 0 };
  const mechanism = detail?.mechanism_snapshot || { top_links: [], evidence_sources: [], by_neighbor_type: {}, context_summary: [] };
  const algorithmEvidence = detail?.algorithm_evidence || { available: false, row_count: 0, methods: [], top_rows: [] };
  const comparison = compareState?.data || null;
  const sevenDtiModels = SEVEN_DTI_MODEL_META.map((item) => item.label);
  const smiles = ann.smiles || "";
  const textDescription = ann.text_description || "";
  const sideEffectSummary = ann.side_effect_summary || "";
  const ontologyTerms = ann.ontology_terms || "";
  const targetSummary = ann.target_summary || "";
  const diseaseSummary = ann.disease_summary || "";
  const synonyms = React.useMemo(() => {
    if (!ann.synonyms_json) return [];
    try {
      const parsed = JSON.parse(ann.synonyms_json);
      return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 12) : [];
    } catch {
      return [];
    }
  }, [ann.synonyms_json]);
  const uniprot = ann.uniprot_accession || "";
  const seq = ann.target_sequence || "";
  const annotationSource = ann.annotation_source || "";
  const unresolvedHintMap = {
    non_protein_target_no_sequence_expected: "Non-protein target (no protein sequence expected).",
    target_unresolved_needs_manual_curation: "Target metadata needs manual curation for sequence mapping.",
    uniprot_unresolved_or_inactive: "UniProt accession is inactive/unresolved; sequence unavailable."
  };
  const unresolvedHint = unresolvedHintMap[annotationSource] || "";
  const structureUrl =
    ann.structure_image_url ||
    (smiles ? `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/image` : "");
  const structureIsPlaceholder = Boolean(ann.structure_image_url && ann.structure_image_url.endsWith(".svg"));
  const drugMissingSmilesReason = smiles
    ? ""
    : "No canonical SMILES was resolved. This record is likely a biologic, peptide, complex formulation, or other non-small-molecule drug.";
  const drugStructureReason = !structureUrl
    ? "No structure image is currently available for this drug record."
    : structureIsPlaceholder
      ? "A placeholder structure is shown because no resolved public small-molecule structure was available for this drug record."
      : "";
  const uniprotMissingReason = uniprot
    ? ""
    : (unresolvedHint || "No UniProt accession is available for this target record.");
  const hasRenderableGraph = (graph?.nodes?.length || 0) > 1 && (graph?.edges?.length || 0) > 0;
  const graphNodeCount = graph?.nodes?.length || 0;
  const graphEdgeCount = graph?.edges?.length || 0;
  const graphNodeLabelMap = React.useMemo(
    () => Object.fromEntries((graph?.nodes || []).map((n) => [n.id, n.display_name || n.label || n.id])),
    [graph]
  );
  const sortResultIcon = (key) => {
    if (resultSort.key !== key) return "↕";
    return resultSort.direction === "asc" ? "↑" : "↓";
  };
  const toggleResultSort = (key) => {
    setResultSort((prev) => (
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "source_label" || key === "target_label" ? "asc" : "desc" }
    ));
  };
  const visibleEdgeRows = React.useMemo(() => {
    const numKeys = new Set(["weight", "support_score"]);
    const rows = (graph?.edges || []).map((edge) => ({
      ...edge,
      source_label: graphNodeLabelMap[edge.source] || edge.source,
      target_label: graphNodeLabelMap[edge.target] || edge.target,
    }));
    rows.sort((a, b) => {
      const { key, direction } = resultSort;
      const dir = direction === "asc" ? 1 : -1;
      if (numKeys.has(key)) {
        const av = Number(a?.[key] ?? Number.NEGATIVE_INFINITY);
        const bv = Number(b?.[key] ?? Number.NEGATIVE_INFINITY);
        return (av - bv) * dir;
      }
      return String(a?.[key] ?? "").localeCompare(String(b?.[key] ?? "")) * dir;
    });
    return rows.slice(0, 18);
  }, [graph, graphNodeLabelMap, resultSort]);
  const nodeTypeMap = (graph?.nodes || []).reduce((acc, n) => {
    const k = n.node_type || "Other";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const drugCount = nodeTypeMap.Drug || 0;
  const targetCount = nodeTypeMap.Target || 0;
  const diseaseCount = nodeTypeMap.Disease || 0;
  const coveragePct = Math.round((profile.coverage_ratio || 0) * 100);
  const algoRowLabel = (row) => {
    if (!row) return "-";
    return `${row.Drug_Label || row.Drug_ID} -> ${row.Target_Label || row.Target_ID} -> ${row.Disease_Label || row.Disease_ID}`;
  };
  const edgeTypeBadgeClass = (value) => {
    if (value === "Known") return "is-known";
    if (value === "Predicted") return "is-predicted";
    if (value === "Known+Predicted") return "is-kp";
    return "";
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
  const hoverMatchesDetail = Boolean(hoverState?.id && detail?.node?.id && hoverState.id === detail.node.id);
  const onlineSummary = onlineAnalysisResult?.summary || null;
  const onlineRows = onlineAnalysisResult?.top_rows || [];
  const onlineMethodDistribution = onlineAnalysisResult?.method_distribution || [];
  const onlineVoteDistribution = onlineAnalysisResult?.vote_distribution || [];
  const sevenModelOverview = React.useMemo(() => {
    const rows = algorithmEvidence?.top_rows || [];
    const counts = Object.fromEntries(sevenDtiModels.map((label) => [label, 0]));
    rows.forEach((row) => {
      const supporting = new Set(row?.seven_model_supporting_models || []);
      const scores = row?.seven_model_scores || {};
      sevenDtiModels.forEach((label) => {
        if (supporting.has(label) || scores[label] != null) counts[label] += 1;
      });
    });
    return sevenDtiModels.map((label) => ({
      label,
      count: counts[label],
      active: counts[label] > 0,
    }));
  }, [algorithmEvidence, sevenDtiModels]);
  const activeSevenModelCount = sevenModelOverview.filter((item) => item.active).length;
  const sevenModelTop = [...sevenModelOverview].sort((a, b) => b.count - a.count)[0] || null;
  const sevenModelTopPair = algorithmEvidence?.top_dti_pairs?.[0] || null;
  const sevenModelTopPattern = algorithmEvidence?.top_dti_patterns?.[0] || null;

  React.useEffect(() => {
    if (!structureModalOpen) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") setStructureModalOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [structureModalOpen]);

  const copySequence = React.useCallback(async () => {
    if (!seq?.trim()) return;
    try {
      await navigator.clipboard.writeText(seq);
      setSequenceCopied(true);
      window.setTimeout(() => setSequenceCopied(false), 1200);
    } catch {
      setSequenceCopied(false);
    }
  }, [seq]);

  return (
    <section className="page is-active analysis-page">
      <div className="analysis-header">
        <div>
          <h2>Network Analysis</h2>
          <div className="analysis-subtitle">Structured analysis of Drug-Target-Disease relationships with evidence-aware annotation, filtering, comparison, and released result views.</div>
        </div>
        <div className="toolbar">
          <select value={densityMode} onChange={(e) => onDensityModeChange(e.target.value)}>
            <option value="sparse">Sparse</option>
            <option value="balanced">Balanced</option>
            <option value="dense">Expanded</option>
          </select>
          <button className="btn-quiet" onClick={onResetFilters}>Reset Filters</button>
          <button className="btn-quiet" onClick={onDenseGraph}>Expanded Network</button>
          <button className="btn-quiet" onClick={onAllNetwork}>Load Full Atlas</button>
          <button className="btn-quiet" onClick={onCompareModes}>Comparison View</button>
          <button className="btn-quiet" onClick={onShareState}>Copy Share Link</button>
          <button className="primary" onClick={onExportSubgraph}>Export Current View</button>
        </div>
      </div>

      <div className="analysis-kpis">
        <div className="kpi-card">
          <div className="kpi-label">Visible Nodes</div>
          <div className="kpi-value">{graphNodeCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Visible Edges</div>
          <div className="kpi-value">{graphEdgeCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Drug / Target / Disease</div>
          <div className="kpi-value kpi-split">{drugCount} / {targetCount} / {diseaseCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Current Center</div>
          <div className="kpi-value kpi-center">{centerNode || "-"}</div>
        </div>
      </div>

      <section className="card panel-pad online-analysis-panel">
        <div className="card-head">
          <h3>Online Analysis</h3>
          <div className="muted">Run a query-specific analysis around a released Drug, Target, or Disease node with dynamic support thresholds. This generates a fresh result subset rather than only locating an existing record.</div>
        </div>
        <div className="online-analysis-banner">
          <div>
            <strong>Dynamic result generation</strong>
            <span>Apply thresholds to the released atlas and produce a topic-specific result subset, support profile, and drill-down table.</span>
          </div>
          <span className="online-analysis-banner-tag">Released atlas only</span>
        </div>
        <div className="online-analysis-presets">
          {ONLINE_ANALYSIS_PRESETS.map((preset) => (
            <button
              key={preset.key}
              className={`online-analysis-preset ${onlineAnalysisState?.min_algo_pass === preset.patch.min_algo_pass && onlineAnalysisState?.min_votes === preset.patch.min_votes && (onlineAnalysisState?.txgnn_pass || "") === (preset.patch.txgnn_pass || "") ? "is-active" : ""}`}
              onClick={() => onRunOnlineAnalysis({ focus_id: onlineAnalysisState?.focus_id || centerNode || "", ...preset.patch })}
              type="button"
            >
              <strong>{preset.title}</strong>
              <span>{preset.note}</span>
            </button>
          ))}
        </div>
        <div className="online-analysis-controls">
          <label>
            Focus Node ID
            <input
              value={onlineAnalysisState?.focus_id || ""}
              onChange={(e) => onOnlineAnalysisStateChange({ focus_id: e.target.value })}
              placeholder="DB... / BE... / DIS::..."
            />
          </label>
          <label>
            Min Released Support
            <select
              value={onlineAnalysisState?.min_algo_pass ?? 2}
              onChange={(e) => onOnlineAnalysisStateChange({ min_algo_pass: Number(e.target.value) })}
            >
              <option value={1}>1/3</option>
              <option value={2}>2/3</option>
              <option value={3}>3/3</option>
            </select>
          </label>
          <label>
            Min 7-Model Votes
            <select
              value={onlineAnalysisState?.min_votes ?? 4}
              onChange={(e) => onOnlineAnalysisStateChange({ min_votes: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((value) => (
                <option value={value} key={value}>{value}/7</option>
              ))}
            </select>
          </label>
          <label>
            TXGNN
            <select
              value={onlineAnalysisState?.txgnn_pass || ""}
              onChange={(e) => onOnlineAnalysisStateChange({ txgnn_pass: e.target.value })}
            >
              <option value="">Any</option>
              <option value="1">Passed</option>
              <option value="0">Not passed</option>
            </select>
          </label>
          <label>
            ENR
            <select
              value={onlineAnalysisState?.enr_pass || ""}
              onChange={(e) => onOnlineAnalysisStateChange({ enr_pass: e.target.value })}
            >
              <option value="">Any</option>
              <option value="1">Passed</option>
              <option value="0">Not passed</option>
            </select>
          </label>
          <label>
            RWR
            <select
              value={onlineAnalysisState?.rwr_pass || ""}
              onChange={(e) => onOnlineAnalysisStateChange({ rwr_pass: e.target.value })}
            >
              <option value="">Any</option>
              <option value="1">Passed</option>
              <option value="0">Not passed</option>
            </select>
          </label>
          <label>
            Max Rows
            <select
              value={onlineAnalysisState?.limit ?? 12}
              onChange={(e) => onOnlineAnalysisStateChange({ limit: Number(e.target.value) })}
            >
              {[8, 12, 20, 30, 40].map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="online-analysis-actions">
            <button className="btn-quiet" onClick={() => onOnlineAnalysisStateChange({ focus_id: centerNode || "" })}>Use Current Center</button>
            <button
              className="btn-quiet"
              onClick={() => onRunOnlineAnalysis({
                min_algo_pass: 3,
                min_votes: 4,
                txgnn_pass: "",
                enr_pass: "",
                rwr_pass: "",
              })}
            >
              Consensus-only
            </button>
            <button className="primary" onClick={() => onRunOnlineAnalysis()}>Run Online Analysis</button>
            <button className="btn-quiet" onClick={onExportOnlineAnalysisResults} disabled={!onlineRows.length}>Export Analysis Rows</button>
            <button className="btn-quiet" onClick={() => onLoadOnlineAnalysisSubgraph()} disabled={!onlineRows.length}>Load Analysis Subgraph</button>
          </div>
        </div>
        {onlineAnalysisResult ? (
          <>
            <div className="online-analysis-active-filters">
              <span className="source-chip">focus {onlineAnalysisResult.focus_type}</span>
              <span className="source-chip">released support ≥ {onlineAnalysisState?.min_algo_pass || 0}/3</span>
              <span className="source-chip">7-model votes ≥ {onlineAnalysisState?.min_votes || 0}/7</span>
              {onlineAnalysisState?.txgnn_pass ? <span className="source-chip">TXGNN passed</span> : null}
              {onlineAnalysisState?.enr_pass ? <span className="source-chip">ENR passed</span> : null}
              {onlineAnalysisState?.rwr_pass ? <span className="source-chip">RWR passed</span> : null}
            </div>
            <div className="online-analysis-summary">
              <div className="kpi-card">
                <div className="kpi-label">Focus</div>
                <div className="kpi-value kpi-center">{onlineAnalysisResult.focus_label}</div>
                <div className="item-meta">{onlineAnalysisResult.focus_type} · {onlineAnalysisResult.focus_id}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Released Rows</div>
                <div className="kpi-value">{onlineSummary?.total_rows ?? 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Reach</div>
                <div className="kpi-value kpi-split">{onlineSummary?.drugs ?? 0} / {onlineSummary?.targets ?? 0} / {onlineSummary?.diseases ?? 0}</div>
                <div className="item-meta">drug / target / disease</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Best Support</div>
                <div className="kpi-value kpi-split">{onlineSummary?.max_algo_pass ?? 0}/3 · {onlineSummary?.max_votes ?? 0}/7</div>
              </div>
            </div>
            <div className="online-analysis-grid">
              <section className="card panel-pad">
                <div className="card-head">
                  <h3>Released Method Distribution</h3>
                  <div className="muted">Support patterns after applying the current analysis thresholds.</div>
                </div>
                <div className="list compact">
                  {onlineMethodDistribution.length ? onlineMethodDistribution.map((item) => (
                    <div className="item" key={item.support_pattern_label}>
                      <div className="item-title">{item.support_pattern_label}</div>
                      <div className="item-meta">{item.count} rows</div>
                    </div>
                  )) : <div className="muted">No released rows satisfy the current thresholds.</div>}
                </div>
              </section>
              <section className="card panel-pad">
                <div className="card-head">
                  <h3>7-Model Vote Distribution</h3>
                  <div className="muted">Vote tiers among retained rows in the current analysis subset.</div>
                </div>
                <div className="list compact">
                  {onlineVoteDistribution.length ? onlineVoteDistribution.map((item) => (
                    <div className="item" key={item.total_votes}>
                      <div className="item-title">{item.total_votes}/7 votes</div>
                      <div className="item-meta">{item.count} rows</div>
                    </div>
                  )) : <div className="muted">No retained rows satisfy the current thresholds.</div>}
                </div>
              </section>
            </div>
            <section className="analysis-results-panel online-analysis-results">
              <div className="card-head">
                <h3>Online Analysis Results</h3>
                <div className="muted">Top released prediction rows ranked within the current query-specific analysis subset.</div>
              </div>
              <div className="result-table-wrap analysis-result-wrap">
                <table className="result-table edge-result-table analysis-result-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Drug</th>
                      <th>Target</th>
                      <th>Disease</th>
                      <th>Support</th>
                      <th>Votes</th>
                      <th>TXGNN</th>
                      <th>ENR FDR</th>
                      <th>Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineRows.length ? onlineRows.map((row) => (
                      <tr key={`${row.pair_id}-${row.Disease_ID}`}>
                        <td>{row.result_rank}</td>
                        <td><button className="table-link-btn" onClick={() => onNodeClick(row.Drug_ID)}>{row.Drug_Label || row.Drug_ID}</button></td>
                        <td><button className="table-link-btn" onClick={() => onNodeClick(row.Target_ID)}>{row.Target_Label || row.Target_ID}</button></td>
                        <td><button className="table-link-btn" onClick={() => onNodeClick(row.Disease_ID)}>{row.Disease_Label || row.Disease_ID}</button></td>
                        <td>{renderCoreSupportMeter(row.n_algo_pass)}</td>
                        <td>{renderVoteMeter(row.Total_Votes_Optional7)}</td>
                        <td>{row.TXGNN_score ?? "NA"}</td>
                        <td>{row.ENR_FDR ?? "NA"}</td>
                        <td><button className="btn-quiet compact-btn" onClick={() => onOpenOnlineAnalysisRow(row)}>View in Network</button></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={9}>Run online analysis to generate a query-specific released result subset.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="muted">Use the current center or enter any released Drug, Target, or Disease identifier to generate a query-specific analysis subset.</div>
        )}
      </section>

      {recentCenters?.length ? (
        <div className="recent-centers">
          <span className="muted">Recent centers:</span>
          {recentCenters.map((id) => (
            <button key={id} className="chip" onClick={() => onRecentCenterClick(id)}>
              {id}
            </button>
          ))}
        </div>
      ) : null}

      <section className="card panel-pad analysis-seven-model-panel">
        <div className="card-head">
          <h3>Seven DTI Model Support</h3>
          <div className="muted">The optional DTI vote layer is composed of seven upstream DTI models. Active counts below summarize the current top prediction records for this network view.</div>
        </div>
        <div className="result-summary-strip analysis-seven-model-summary">
          <span className="result-summary-pill">
            <strong>{activeSevenModelCount}/7</strong>
            <em>Active models in current view</em>
          </span>
          {sevenModelTop ? (
            <span className="result-summary-pill">
              <strong>{sevenModelTop.label}</strong>
              <em>{sevenModelTop.count} visible records</em>
            </span>
          ) : null}
          {sevenModelTopPair ? (
            <span className="result-summary-pill">
              <strong>{sevenModelTopPair.pair_label}</strong>
              <em>{sevenModelTopPair.count} top co-support rows</em>
            </span>
          ) : null}
          {sevenModelTopPattern ? (
            <span className="result-summary-pill">
              <strong>{sevenModelTopPattern.pattern_label}</strong>
              <em>{sevenModelTopPattern.count} top support pattern rows</em>
            </span>
          ) : null}
        </div>
        <div className="seven-model-section-note">
          <span className="seven-model-note-badge">Shared atlas encoding</span>
          <span className="seven-model-note-text">Model colors and ordering match the homepage overview and the database result table for quicker cross-page interpretation.</span>
        </div>
        <div className="analysis-seven-model-grid">
          {sevenModelOverview.map((item) => (
            <article className={`analysis-seven-model-card model-${SEVEN_DTI_MODEL_META.find((x) => x.label === item.label)?.key || "graphdta"} ${item.active ? "is-on" : "is-off"}`} key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.active ? `${item.count} visible records` : "No visible record"}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="analysis-layout">
        <section className="card graph-panel">
          <div className="card-head">
            <h3>Drug-Target-Disease Network</h3>
            <div className="muted">Released atlas view · {graphMeta}</div>
          </div>
          <div className="control-grid">
            <label>
              Center Node ID
              <input value={centerNode} onChange={(e) => onCenterNodeChange(e.target.value)} />
            </label>
            <label>
              Network Mode
              <select value={graphMode} onChange={(e) => onGraphModeChange(e.target.value)}>
                <option value="full">full (default)</option>
                <option value="core">core</option>
              </select>
            </label>
            <label>
              Depth
              <select value={depth} onChange={(e) => onControlsChange({ depth: Number(e.target.value) })}>
                <option value={1}>1-hop</option>
                <option value={2}>2-hop</option>
              </select>
            </label>
            <label>
              Max Edges
              <input type="number" min="50" max="2000" value={limit} onChange={(e) => onControlsChange({ limit: Number(e.target.value) })} />
            </label>
            <label>
              Search In Graph
              <input value={graphSearchText} onChange={(e) => onGraphSearchTextChange(e.target.value)} />
            </label>
          </div>

          <div className="path-finder">
            <label>
              Path Source
              <input
                value={pathState.source_id}
                onChange={(e) => onPathStateChange({ source_id: e.target.value })}
                placeholder="DB... / BE... / DIS::..."
              />
            </label>
            <label>
              Path Target
              <input
                value={pathState.target_id}
                onChange={(e) => onPathStateChange({ target_id: e.target.value })}
                placeholder="DB... / BE... / DIS::..."
              />
            </label>
            <label>
              Max Hops
              <select value={pathState.max_hops} onChange={(e) => onPathStateChange({ max_hops: Number(e.target.value) })}>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </label>
            <div className="path-actions">
              <button onClick={onFindPath}>Run Path Analysis</button>
            </div>
          </div>

          <div className="path-finder compare-finder">
            <label>
              Drug A
              <input
                value={compareState?.left_id || ""}
                onChange={(e) => onCompareStateChange({ left_id: e.target.value })}
                placeholder="DB..."
              />
            </label>
            <label>
              Drug B
              <input
                value={compareState?.right_id || ""}
                onChange={(e) => onCompareStateChange({ right_id: e.target.value })}
                placeholder="DB..."
              />
            </label>
            <div className="path-actions">
              <button onClick={onRunDrugCompare}>Run Comparison</button>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <div className="filter-title">Edge Category</div>
              {["Drug-Target", "Drug-Disease", "Target-Disease"].map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={categories.includes(value)}
                    onChange={() => onControlsChange({ categories: toggleArrValue(categories, value) })}
                  />
                  {value}
                </label>
              ))}
            </div>
            <div className="filter-group">
              <div className="filter-title">Edge Type</div>
              {["Known", "Predicted", "Known+Predicted"].map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={types.includes(value)}
                    onChange={() => onControlsChange({ types: toggleArrValue(types, value) })}
                  />
                  {value}
                </label>
              ))}
            </div>
            <div className="filter-actions">
              <button className="primary" onClick={onLoadGraph}>Load Network</button>
              <button onClick={onFitGraph}>Fit Network</button>
              <button onClick={onExpandFromSelected}>Expand Selected Node</button>
            </div>
          </div>

          <div className="legend">
            <span><i className="dot drug" />Drug</span>
            <span><i className="dot target" />Target</span>
            <span><i className="dot disease" />Disease</span>
            <span><i className="line known" />Known</span>
            <span><i className="line predicted" />Predicted</span>
            <span><i className="line kp" />Known+Predicted</span>
          </div>

          <div className="graph-wrap">
            <GraphCanvas
              graph={graph}
              centerId={centerNode}
              searchText={graphSearchText}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeHover={onHoverNodeChange}
              fitSignal={fitSignal}
              densityMode={densityMode}
            />
            {graphLoading && !hasRenderableGraph ? (
              <div className="graph-loading">
                <div className="skeleton-title" />
                <div className="skeleton-row" />
                <div className="skeleton-row short" />
                <div className="skeleton-grid">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
            {hoverState ? (
              <div className="hover-card" style={{ left: hoverState.x + 22, top: hoverState.y + 160 }}>
                <div className="hover-k">{hoverState.node_type}</div>
                <div className="hover-v">{hoverState.label}</div>
                <div className="hover-id">{hoverState.id}</div>
                <div className="hover-meta">degree {hoverState.degree ?? 0}</div>
                <div className="algo-chip-row compact">
                  <span className="algo-chip is-on">Known {hoverState.evidence?.Known ?? 0}</span>
                  <span className="algo-chip is-on">Pred {hoverState.evidence?.Predicted ?? 0}</span>
                  <span className="algo-chip is-on">K+P {hoverState.evidence?.["Known+Predicted"] ?? 0}</span>
                </div>
                {hoverMatchesDetail && algorithmEvidence.available ? (
                  <div className="hover-support-block">
                    <div className="hover-support-row">
                      <span className="hover-support-label">Released support</span>
                      {renderCoreSupportMeter(algorithmEvidence.max_n_algo_pass)}
                    </div>
                    <div className="hover-support-row">
                      <span className="hover-support-label">7-model votes</span>
                      {renderVoteMeter(algorithmEvidence.max_total_votes)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <section className="analysis-results-panel">
            <div className="card-head">
              <h3>Current Network Results</h3>
              <div className="muted">Top visible relationships in the current network view. Click column labels to sort the current result set.</div>
            </div>
            <div className="result-table-wrap analysis-result-wrap">
              <table className="result-table edge-result-table analysis-result-table">
                <thead>
                  <tr>
                    <th><button className="table-sort-btn" onClick={() => toggleResultSort("source_label")}>Source {sortResultIcon("source_label")}</button></th>
                    <th><button className="table-sort-btn" onClick={() => toggleResultSort("target_label")}>Target {sortResultIcon("target_label")}</button></th>
                    <th><button className="table-sort-btn" onClick={() => toggleResultSort("edge_category")}>Category {sortResultIcon("edge_category")}</button></th>
                    <th><button className="table-sort-btn" onClick={() => toggleResultSort("edge_type")}>Evidence {sortResultIcon("edge_type")}</button></th>
                    <th><button className="table-sort-btn" onClick={() => toggleResultSort("support_score")}>Score {sortResultIcon("support_score")}</button></th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEdgeRows.length ? visibleEdgeRows.map((edge, idx) => (
                    <tr key={`${edge.source}-${edge.target}-${idx}`}>
                      <td>{edge.source_label || edge.source}</td>
                      <td>{edge.target_label || edge.target}</td>
                      <td>{edge.edge_category}</td>
                      <td><span className={`db-badge ${edgeTypeBadgeClass(edge.edge_type)}`}>{edge.edge_type}</span></td>
                      <td>{edge.support_score ?? "NA"}</td>
                      <td>{edge.remark || "-"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6}>No released relationships are visible in the current network view.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="side-column">
          <section className="card panel-pad rise-in">
            <h3>Record Details</h3>
            <div key={`selected-${detailKey}`} className="card-swap">
              {detail?.node ? (
                <>
                  <div className="item-title">{detail.node.display_name || detail.node.label}</div>
                  <div className="item-meta">{detail.node.node_type} | {detail.node.id}</div>
                  {detail.node.node_type === "Drug" ? (
                    <div className="annot-box">
                      <div className="annot-title">SMILES</div>
                      <pre className="annot-text smiles-box">{smiles || "SMILES not available"}</pre>
                      {!smiles ? <div className="annot-reason">{drugMissingSmilesReason}</div> : null}
                      {textDescription ? (
                        <>
                          <div className="annot-title annot-subtitle">Description</div>
                          <div className="annot-text">{textDescription}</div>
                        </>
                      ) : null}
                      {ontologyTerms ? (
                        <>
                          <div className="annot-title annot-subtitle">Ontology</div>
                          <div className="annot-text">{ontologyTerms}</div>
                        </>
                      ) : null}
                      {sideEffectSummary ? (
                        <>
                          <div className="annot-title annot-subtitle">Safety / Interaction Notes</div>
                          <div className="annot-text">{sideEffectSummary}</div>
                        </>
                      ) : null}
                      {synonyms.length ? (
                        <>
                          <div className="annot-title annot-subtitle">Synonyms</div>
                          <div className="source-chip-wrap">
                            {synonyms.map((item) => <span className="source-chip" key={item}>{item}</span>)}
                          </div>
                        </>
                      ) : null}
                      {targetSummary ? (
                        <>
                          <div className="annot-title annot-subtitle">Top Target Summary</div>
                          <div className="annot-text">{targetSummary}</div>
                        </>
                      ) : null}
                      {diseaseSummary ? (
                        <>
                          <div className="annot-title annot-subtitle">Top Disease Summary</div>
                          <div className="annot-text">{diseaseSummary}</div>
                        </>
                      ) : null}
                      {structureUrl ? (
                        <>
                          <img
                            className="chem-img"
                            src={structureUrl}
                            alt="chemical structure"
                            onClick={() => setStructureModalOpen(true)}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <div className="structure-actions">
                            <button
                              className="btn-quiet"
                              onClick={() => setStructureModalOpen(true)}
                              type="button"
                            >
                              Enlarge Structure
                            </button>
                            <a
                              className="structure-download-btn"
                              href={structureUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={`${detail.node.id || "drug"}_structure.png`}
                            >
                              Download Structure PNG
                            </a>
                          </div>
                          {drugStructureReason ? <div className="annot-reason">{drugStructureReason}</div> : null}
                        </>
                      ) : (
                        <div className="annot-reason">{drugStructureReason}</div>
                      )}
                    </div>
                  ) : null}
                  {detail.node.node_type === "Target" ? (
                    <div className="annot-box">
                      <div className="annot-title">UniProt / Sequence</div>
                      <div className="annot-text annot-uniprot">
                        {uniprot ? (
                          <a href={`https://www.uniprot.org/uniprotkb/${uniprot}`} target="_blank" rel="noreferrer">
                            {uniprot}
                          </a>
                        ) : (
                          "UniProt accession not available"
                        )}
                      </div>
                      {!uniprot ? <div className="annot-reason">{uniprotMissingReason}</div> : null}
                      {seq ? (
                        <>
                          <pre className="seq-box">{seq}</pre>
                          <div className="sequence-actions">
                            <button className="btn-quiet" type="button" onClick={copySequence}>
                              {sequenceCopied ? "Sequence Copied" : "Copy Sequence"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="item-meta">
                          {unresolvedHint || "Sequence information is not available for the current record."}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="muted">Select a node in the network or results list to view its details.</div>
              )}
              <div className="list compact">{renderEdgeStats(detail?.edge_stats)}</div>
            </div>
          </section>

          <section className="card panel-pad rise-in delay-1">
            <h3>Multi-Modal Profile</h3>
            <div className="modality-summary">
              <div className="modality-summary-top">
                <span>Coverage</span>
                <strong>{profile.available_modalities}/{profile.total_modalities}</strong>
              </div>
              <div className="bar modality-bar"><i className="known" style={{ width: `${coveragePct}%` }} /></div>
              <div className="item-meta">Current evidence coverage across available annotation modalities</div>
              <div className="quality-row">
                <span className={`quality-pill quality-${String(profile.quality_tier || "low").toLowerCase()}`}>{profile.quality_tier || "Low"} quality</span>
                <strong>{profile.quality_score ?? 0}</strong>
              </div>
              {(profile.missing_modalities || []).length ? (
                <div className="annot-reason">Unavailable modalities: {profile.missing_modalities.join(", ")}</div>
              ) : null}
            </div>
            <div className="modality-grid">
              {(profile.modalities || []).map((item) => (
                <div key={item.key} className={`modality-card ${item.available ? "is-on" : "is-off"}`}>
                  <div className="modality-card-head">
                    <span>{item.label}</span>
                    <i className={`modality-dot ${item.available ? "is-on" : "is-off"}`} />
                  </div>
                  <div className="modality-card-meta">{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card panel-pad rise-in delay-1">
            <h3>Evidence Composition</h3>
            <div key={`evidence-${detailKey}`} className="evidence-bars card-swap">
              <div className="bar-item">
                <div className="bar-head"><span>Known</span><span>{knownCount}</span></div>
                <div className="bar"><i className="known" style={{ width: `${Math.min(100, knownCount * 5)}%` }} /></div>
              </div>
              <div className="bar-item">
                <div className="bar-head"><span>Predicted</span><span>{predictedCount}</span></div>
                <div className="bar"><i className="predicted" style={{ width: `${Math.min(100, predictedCount * 5)}%` }} /></div>
              </div>
              <div className="bar-item">
                <div className="bar-head"><span>Known+Predicted</span><span>{kpCount}</span></div>
                <div className="bar"><i className="kp" style={{ width: `${Math.min(100, kpCount * 5)}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="card panel-pad rise-in delay-1">
            <h3>Algorithm Evidence</h3>
            {algorithmEvidence.available ? (
              <>
                <div className="algo-evidence-summary">
                  <span className="source-chip">prediction rows {algorithmEvidence.row_count}</span>
                  <span className="source-chip">max released support {algorithmEvidence.max_n_algo_pass ?? 0}/3</span>
                  <span className="source-chip">avg 7-model votes {algorithmEvidence.avg_total_votes ?? 0}/7</span>
                  <span className="source-chip">max 7-model votes {algorithmEvidence.max_total_votes ?? 0}/7</span>
                </div>
                <div className="algo-evidence-grid">
                  {(algorithmEvidence.methods || []).map((item) => (
                    <div className={`algo-evidence-card ${(item.positive_count || 0) > 0 ? "is-on" : "is-off"}`} key={item.key}>
                      <div className="algo-evidence-head">
                        <span>{item.label}</span>
                        <strong>{item.positive_count}/{item.row_count}</strong>
                      </div>
                      <div className="algo-evidence-meta">{item.headline}</div>
                      <div className="bar mini"><i className="known" style={{ width: `${Math.max(6, Math.min(100, item.coverage_pct || 0))}%` }} /></div>
                      <div className="algo-evidence-value">{item.coverage_pct}% support</div>
                    </div>
                  ))}
                </div>
                <div className="mechanism-section">
                  <div className="annot-title">Top Prediction Records</div>
                  <div className="mechanism-links">
                    {(algorithmEvidence.top_rows || []).map((row, idx) => (
                      <div className="mechanism-link-card" key={`${row.Drug_ID}-${row.Target_ID}-${row.Disease_ID}-${idx}`}>
                        <div className="mechanism-link-head">
                          <span>{algoRowLabel(row)}</span>
                          <em>{row.gene_name || "gene annotation unavailable"}</em>
                        </div>
                        <div className="algo-chip-row compact">
                          <span className={`algo-chip ${String(row.TXGNN_pass) === "1" ? "is-on" : "is-off"}`}>TXGNN</span>
                          <span className={`algo-chip ${String(row.ENR_pass) === "1" ? "is-on" : "is-off"}`}>ENR</span>
                          <span className={`algo-chip ${String(row.RWR_pass) === "1" ? "is-on" : "is-off"}`}>RWR</span>
                        </div>
                        <div className="algo-chip-row compact">
                          {SEVEN_DTI_MODEL_META.map((item) => (
                            <span
                              className={`algo-chip model-${item.key} ${(row.seven_model_supporting_models || []).includes(item.label) || row.seven_model_scores?.[item.label] != null ? "is-on" : "is-off"}`}
                              key={item.label}
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                        <div className="support-meter-row">
                          <div className="support-meter-card">
                            <span>Released method support</span>
                            {renderCoreSupportMeter(row.n_algo_pass)}
                          </div>
                          <div className="support-meter-card">
                            <span>7-model vote support</span>
                            {renderVoteMeter(row.seven_model_total_votes)}
                          </div>
                        </div>
                        <div className="mechanism-link-meta">TXGNN score={row.TXGNN_score ?? "-"} · ENR FDR={row.ENR_FDR ?? "-"}</div>
                        <div className="mechanism-link-meta">{((row.seven_model_supporting_models || []).join(", ")) || "no explicit per-model list"}</div>
                        <div className="algo-evidence-grid compact seven-model-score-grid">
                          {SEVEN_DTI_MODEL_META.map((item) => {
                            const score = row.seven_model_scores?.[item.label];
                            const supported = (row.seven_model_supporting_models || []).includes(item.label);
                            return (
                              <div className={`algo-evidence-card model-${item.key} ${score != null || supported ? "is-on" : "is-off"}`} key={item.label}>
                                <div className="algo-evidence-head"><span>{item.label}</span><strong>{score != null ? "Scored" : "NA"}</strong></div>
                                <div className="algo-evidence-meta">Raw DTI model output</div>
                                <div className="algo-evidence-value">{score != null ? score : "-"}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">No prediction-model summary is available for the current record.</div>
            )}
          </section>

          <section className="card panel-pad rise-in delay-2">
            <h3>Mechanism Snapshot</h3>
            <div className="mechanism-section">
              <div className="annot-title">Top Linked Nodes</div>
              <div className="mechanism-links">
                {(mechanism.top_links || []).length ? mechanism.top_links.map((item) => (
                  <div className="mechanism-link-card" key={`${item.neighbor_id}-${item.edge_category}-${item.edge_type}`}>
                    <div className="mechanism-link-head">
                      <span>{item.neighbor_label}</span>
                      <em>{item.neighbor_type}</em>
                    </div>
                    <div className="mechanism-link-meta">{item.edge_category} / {item.edge_type}</div>
                    <div className="mechanism-link-meta">weight={item.weight ?? "NA"} · score={item.support_score ?? "NA"}</div>
                  </div>
                )) : <div className="empty-state">No mechanism summary is available for the current record.</div>}
              </div>
            </div>
            <div className="mechanism-section">
              <div className="annot-title">Evidence Sources</div>
              <div className="source-chip-wrap">
                {(mechanism.evidence_sources || []).length ? mechanism.evidence_sources.map((item) => (
                  <span className="source-chip" key={item.name}>{item.name} ({item.count})</span>
                )) : <div className="empty-state">No evidence-source summary is available for the current record.</div>}
              </div>
            </div>
            <div className="mechanism-section">
              <div className="annot-title">Context Summary</div>
              <div className="mechanism-links">
                {(mechanism.context_summary || []).length ? mechanism.context_summary.map((item) => (
                  <div className="mechanism-link-card" key={item}>
                    <div className="mechanism-link-meta">{item}</div>
                  </div>
                )) : <div className="empty-state">No contextual summary is available for the current record.</div>}
              </div>
            </div>
          </section>

          <section className="card panel-pad rise-in delay-2">
            <h3>Drug Pair Comparison</h3>
            {comparison ? (
              <div className="comparison-grid">
                <div className="comparison-card">
                  <div className="annot-title">Shared Mechanism Score</div>
                  <div className="comparison-score">{comparison.shared_mechanism_score}</div>
                  <div className="item-meta">{comparison.interpretation}</div>
                  <div className="comparison-actions">
                    <button className="primary" onClick={onLoadCompareSubgraph}>Load Comparison Subgraph</button>
                  </div>
                </div>
                <div className="comparison-card">
                  <div className="annot-title">Target Overlap</div>
                  <div className="item-meta">
                    shared {comparison.target_overlap.shared_count} / {comparison.left.display_name || comparison.left.label} {comparison.target_overlap.left_count} / {comparison.right.display_name || comparison.right.label} {comparison.target_overlap.right_count}
                  </div>
                  <div className="item-meta">jaccard={comparison.target_overlap.jaccard}</div>
                  <div className="source-chip-wrap">
                    {(comparison.target_overlap.shared_examples || []).map((item) => (
                      <button className="source-chip source-chip-button" key={item.id} onClick={() => onCompareJump(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="comparison-card">
                  <div className="annot-title">Disease Overlap</div>
                  <div className="item-meta">
                    shared {comparison.disease_overlap.shared_count} / {comparison.left.display_name || comparison.left.label} {comparison.disease_overlap.left_count} / {comparison.right.display_name || comparison.right.label} {comparison.disease_overlap.right_count}
                  </div>
                  <div className="item-meta">jaccard={comparison.disease_overlap.jaccard}</div>
                  <div className="source-chip-wrap">
                    {(comparison.disease_overlap.shared_examples || []).map((item) => (
                      <button className="source-chip source-chip-button" key={item.id} onClick={() => onCompareJump(item.id)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">Enter two Drug identifiers above to compare target overlap, disease overlap, and shared mechanism support.</div>
            )}
          </section>

          <section className="card panel-pad rise-in delay-2">
            <h3>Neighbors</h3>
            <div className="neighbor-tools">
              <input
                placeholder="Search neighbors..."
                value={neighborState.q}
                onChange={(e) => onNeighborQueryChange({ q: e.target.value })}
              />
              <select
                value={neighborState.edge_type}
                onChange={(e) => onNeighborQueryChange({ edge_type: e.target.value })}
              >
                <option value="">All types</option>
                <option value="Known">Known</option>
                <option value="Predicted">Predicted</option>
                <option value="Known+Predicted">Known+Predicted</option>
              </select>
              <select
                value={neighborState.edge_category}
                onChange={(e) => onNeighborQueryChange({ edge_category: e.target.value })}
              >
                <option value="">All categories</option>
                <option value="Drug-Target">Drug-Target</option>
                <option value="Drug-Disease">Drug-Disease</option>
                <option value="Target-Disease">Target-Disease</option>
              </select>
              <select
                value={neighborState.order_by}
                onChange={(e) => onNeighborQueryChange({ order_by: e.target.value })}
              >
                <option value="weight_desc">Sort: weight</option>
                <option value="score_desc">Sort: score</option>
                <option value="label_asc">Sort: label</option>
              </select>
              <button onClick={onNeighborSearch}>Filter</button>
            </div>
            <div className="muted">
              page {neighborState.page} · size {neighborState.page_size} · total {neighborState.total}
            </div>
            <div key={`neighbors-${detailKey}`} className="list card-swap">
              {(neighborState.items || []).length ? (neighborState.items || []).map((n) => (
                <div className="item" key={`${n.neighbor_id}-${n.edge_category}-${n.edge_type}`} onClick={() => onNodeClick(n.neighbor_id)}>
                  <div className="item-title">{n.neighbor_label}</div>
                  <div className="item-meta">{n.neighbor_type} | {n.neighbor_id}</div>
                  <div className="item-meta">{n.edge_category} / {n.edge_type} | score={n.support_score ?? "NA"}</div>
                </div>
              )) : <div className="empty-state">No neighboring records match the current filter settings.</div>}
            </div>
            <div className="pager">
              <button onClick={() => onNeighborPage(-1)} disabled={neighborState.page <= 1}>Previous</button>
              <button
                onClick={() => onNeighborPage(1)}
                disabled={neighborState.page * neighborState.page_size >= neighborState.total}
              >
                Next Page
              </button>
            </div>
          </section>
        </aside>
      </div>
      {structureModalOpen && structureUrl ? (
        <div className="structure-modal-overlay" onClick={() => setStructureModalOpen(false)} role="presentation">
          <div className="structure-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="structure-modal-head">
              <div className="structure-modal-title">Chemical Structure View</div>
              <button className="btn-quiet" type="button" onClick={() => setStructureModalOpen(false)}>Close Viewer</button>
            </div>
            <img className="structure-modal-img" src={structureUrl} alt="chemical structure large view" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
