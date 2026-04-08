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
  activeSection,
  nodesState,
  edgesState,
  predictionState,
  ncrnaEvidenceState,
  ncrnaEdgeState,
  researchSummary,
  nodeFilters,
  edgeFilters,
  predictionFilters,
  ncrnaEvidenceFilters,
  ncrnaEdgeFilters,
  onNodeFiltersChange,
  onEdgeFiltersChange,
  onPredictionFiltersChange,
  onNcrnaEvidenceFiltersChange,
  onNcrnaEdgeFiltersChange,
  onNodeSearch,
  onEdgeSearch,
  onPredictionSearch,
  onNcrnaEvidenceSearch,
  onNcrnaEdgeSearch,
  onNodePage,
  onEdgePage,
  onPredictionPage,
  onNcrnaEvidencePage,
  onNcrnaEdgePage,
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
  canPredictionNext,
  canNcrnaEvidencePrev,
  canNcrnaEvidenceNext,
  canNcrnaEdgePrev,
  canNcrnaEdgeNext,
}) {
  const ncrnaSectionRef = React.useRef(null);
  const [selectedPrediction, setSelectedPrediction] = React.useState(null);
  const [predictionSort, setPredictionSort] = React.useState({ key: "result_rank", direction: "asc" });
  const [selectedTargetDetail, setSelectedTargetDetail] = React.useState(null);
  const [selectedDiseaseDetail, setSelectedDiseaseDetail] = React.useState(null);
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
        <div className="seven-model-hover-subtitle">The same disease network palette and model order are used across the homepage and analysis view.</div>
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
  const ncrnaSummary = researchSummary?.ncrna_summary || null;
  const ncrnaOverview = ncrnaSummary?.overview || null;
  const ttdSummary = researchSummary?.ttd_summary || null;
  const ttdOverview = ttdSummary?.overview || null;
  const ttdSupportedResults = researchSummary?.ttd_supported_results || null;
  const ttdSupportedOverview = ttdSupportedResults?.overview || null;
  const targetCentricModule = researchSummary?.target_centric_module || null;
  const targetCentricOverview = targetCentricModule?.overview || null;
  const targetCentricRows = targetCentricModule?.rows || [];
  const diseaseCentricModule = researchSummary?.disease_centric_module || null;
  const diseaseCentricOverview = diseaseCentricModule?.overview || null;
  const diseaseCentricRows = diseaseCentricModule?.rows || [];
  const ncrnaLinkedResults = researchSummary?.ncrna_linked_results || null;
  const ncrnaLinkedOverview = ncrnaLinkedResults?.overview || null;
  const ncrnaLinkedDrugs = ncrnaLinkedResults?.top_linked_drugs || [];
  const ncrnaLinkedConsensusCases = ncrnaLinkedResults?.top_linked_consensus_cases || [];
  const ncrnaLinkedApprovedRows = ncrnaLinkedResults?.top_linked_selected_approved || [];
  const ncrnaTopNcrnas = ncrnaSummary?.top_ncrnas || [];
  const ncrnaTopDrugs = ncrnaSummary?.top_drugs || [];
  const ncrnaTypeDistribution = ncrnaSummary?.type_distribution || [];
  const ncrnaRelationDistribution = ncrnaSummary?.relation_distribution || [];
  const ttdTopSupportedDrugs = ttdSummary?.top_supported_drugs || [];
  const ttdTopSupportedTargets = ttdSummary?.top_supported_targets || [];
  const ttdTargetTypeDistribution = ttdSummary?.target_type_distribution || [];
  const ttdDrugStatusDistribution = ttdSummary?.drug_status_distribution || [];
  const ttdMoaDistribution = ttdSummary?.moa_distribution || [];
  const ttdSupportedConsensusCases = ttdSupportedResults?.top_consensus_cases || [];
  const ttdSupportedApprovedRows = ttdSupportedResults?.top_approved_rows || [];
  const ttdSupportedConsensusMap = React.useMemo(
    () => Object.fromEntries(
      ttdSupportedConsensusCases.map((item) => [`${item.drug_id}|${item.target_id}|${item.disease_id}`, item])
    ),
    [ttdSupportedConsensusCases]
  );
  const ttdSupportedApprovedMap = React.useMemo(
    () => Object.fromEntries(
      ttdSupportedApprovedRows.map((item) => [`${item.drug_id}|${item.target_id}|${item.disease_id}`, item])
    ),
    [ttdSupportedApprovedRows]
  );
  const diseaseCentricMap = React.useMemo(
    () => Object.fromEntries(diseaseCentricRows.map((item) => [item.disease_id, item])),
    [diseaseCentricRows]
  );
  const representativeDrugs = researchSummary?.representative_drugs || [];
  const representativeCases = researchSummary?.representative_cases || [];
  const approvedValidation = researchSummary?.approved_validation || null;
  const pipelineShrinkage = researchSummary?.pipeline_shrinkage || null;
  const releasedDtiAudit = researchSummary?.released_dti_audit || null;
  const releasedDtiTtdSummary = researchSummary?.released_dti_ttd_summary || null;
  const releasedDiseaseSummary = researchSummary?.released_disease_summary || null;
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
  const ncrnaLinkedDrugMap = React.useMemo(
    () => Object.fromEntries(ncrnaLinkedDrugs.map((item) => [item.drug_id, item])),
    [ncrnaLinkedDrugs]
  );
  const ncrnaLinkedConsensusMap = React.useMemo(
    () => Object.fromEntries(
      ncrnaLinkedConsensusCases.map((item) => [`${item.drug_id}|${item.target_id}|${item.disease_id}`, item])
    ),
    [ncrnaLinkedConsensusCases]
  );
  const ncrnaLinkedApprovedMap = React.useMemo(
    () => Object.fromEntries(
      ncrnaLinkedApprovedRows.map((item) => [`${item.drug_id}|${item.target_id}|${item.disease_id}`, item])
    ),
    [ncrnaLinkedApprovedRows]
  );
  const consensusNcRnaSummary = React.useMemo(() => {
    const linkedRows = highConsensusCases.filter((item) => ncrnaLinkedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`]);
    const linkedDrugCount = new Set(linkedRows.map((item) => item.drug_id).filter(Boolean)).size;
    const linkedNcRnaCount = new Set(
      linkedRows.flatMap((item) => {
        const linked = ncrnaLinkedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`];
        return linked?.top_ncrna_name ? [linked.top_ncrna_name] : [];
      })
    ).size;
    const topLink = linkedRows.length
      ? linkedRows
        .map((item) => ncrnaLinkedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`])
        .filter(Boolean)
        .sort((a, b) => (b.linked_ncrna_count || 0) - (a.linked_ncrna_count || 0))[0]
      : null;
    return {
      linked_row_count: linkedRows.length,
      linked_drug_count: linkedDrugCount,
      linked_ncrna_count: linkedNcRnaCount,
      top_ncrna_name: topLink?.top_ncrna_name || null,
    };
  }, [highConsensusCases, ncrnaLinkedConsensusMap]);
  const approvedNcRnaSummary = React.useMemo(() => {
    const linkedRows = topApprovedLeaderboard.filter((item) => ncrnaLinkedApprovedMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`] || ncrnaLinkedDrugMap[item.drug_id]);
    const linkedDrugCount = new Set(linkedRows.map((item) => item.drug_id).filter(Boolean)).size;
    const linkedNcRnaCount = new Set(
      linkedRows.flatMap((item) => {
        const linked = ncrnaLinkedApprovedMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`] || ncrnaLinkedDrugMap[item.drug_id];
        return linked?.top_ncrna_name ? [linked.top_ncrna_name] : [];
      })
    ).size;
    const topLink = linkedRows.length
      ? linkedRows
        .map((item) => ncrnaLinkedApprovedMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`] || ncrnaLinkedDrugMap[item.drug_id])
        .filter(Boolean)
        .sort((a, b) => (b.linked_ncrna_count || 0) - (a.linked_ncrna_count || 0))[0]
      : null;
    return {
      linked_row_count: linkedRows.length,
      linked_drug_count: linkedDrugCount,
      linked_ncrna_count: linkedNcRnaCount,
      top_ncrna_name: topLink?.top_ncrna_name || null,
    };
  }, [topApprovedLeaderboard, ncrnaLinkedApprovedMap, ncrnaLinkedDrugMap]);

  React.useEffect(() => {
    if (!targetCentricRows.length) {
      setSelectedTargetDetail(null);
      return;
    }
    setSelectedTargetDetail((prev) => {
      if (prev?.target_id && targetCentricRows.some((item) => item.target_id === prev.target_id)) {
        return targetCentricRows.find((item) => item.target_id === prev.target_id) || targetCentricRows[0];
      }
      return targetCentricRows[0];
    });
  }, [targetCentricRows]);

  React.useEffect(() => {
    if (!diseaseCentricRows.length) {
      setSelectedDiseaseDetail(null);
      return;
    }
    setSelectedDiseaseDetail((prev) => {
      if (prev?.disease_id && diseaseCentricRows.some((item) => item.disease_id === prev.disease_id)) {
        return diseaseCentricRows.find((item) => item.disease_id === prev.disease_id) || diseaseCentricRows[0];
      }
      return diseaseCentricRows[0];
    });
  }, [diseaseCentricRows]);
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

  React.useEffect(() => {
    if (activeSection === "ncrna" && ncrnaSectionRef.current) {
      ncrnaSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSection, researchSummary]);

  return (
    <section className="page is-active db-page">
      <div className="analysis-header page-head">
        <div>
          <h2>Disease Network Database</h2>
          <div className="analysis-subtitle">Structured access to released node, edge, evidence, and prediction-result tables in the curated disease network atlas.</div>
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
                placeholder="Search a drug, target, disease, or ncRNA record..."
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
                <option value="ncRNA">ncRNA</option>
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
                <option value="ncRNA-Drug">ncRNA-Drug</option>
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
            <div className="db-query-label">ncRNA Evidence Query</div>
            <div className="inline-filters edge db-filters db-filters-top prediction-filters">
              <input
                placeholder="Search ncRNA name, drug, phenotype, condition, or reference..."
                value={ncrnaEvidenceFilters.q}
                onChange={(e) => onNcrnaEvidenceFiltersChange({ q: e.target.value })}
              />
              <select
                value={ncrnaEvidenceFilters.ncrna_type}
                onChange={(e) => onNcrnaEvidenceFiltersChange({ ncrna_type: e.target.value })}
              >
                <option value="">All ncRNA types</option>
                <option value="miRNA">miRNA</option>
                <option value="lncRNA">lncRNA</option>
                <option value="circRNA">circRNA</option>
              </select>
              <select
                value={ncrnaEvidenceFilters.relation_category}
                onChange={(e) => onNcrnaEvidenceFiltersChange({ relation_category: e.target.value })}
              >
                <option value="">All curated relations</option>
                <option value="DrugResponse">DrugResponse</option>
                <option value="DrugTarget">DrugTarget</option>
              </select>
              <select
                value={ncrnaEvidenceFilters.fda}
                onChange={(e) => onNcrnaEvidenceFiltersChange({ fda: e.target.value })}
              >
                <option value="">All FDA labels</option>
                <option value="approved">approved</option>
                <option value="NA">NA</option>
              </select>
              <button onClick={onNcrnaEvidenceSearch}>Search ncRNA Evidence</button>
            </div>
          </div>
          <div className="db-query-block">
            <div className="db-query-label">ncRNA-Drug Relationship Query</div>
            <div className="inline-filters edge db-filters db-filters-top prediction-filters">
              <input
                placeholder="Search ncRNA, drug, phenotype, condition, or target gene..."
                value={ncrnaEdgeFilters.q}
                onChange={(e) => onNcrnaEdgeFiltersChange({ q: e.target.value })}
              />
              <select
                value={ncrnaEdgeFilters.ncrna_type}
                onChange={(e) => onNcrnaEdgeFiltersChange({ ncrna_type: e.target.value })}
              >
                <option value="">All ncRNA types</option>
                <option value="miRNA">miRNA</option>
                <option value="lncRNA">lncRNA</option>
                <option value="circRNA">circRNA</option>
              </select>
              <select
                value={ncrnaEdgeFilters.relation_category}
                onChange={(e) => onNcrnaEdgeFiltersChange({ relation_category: e.target.value })}
              >
                <option value="">All curated relations</option>
                <option value="DrugResponse">DrugResponse</option>
                <option value="DrugTarget">DrugTarget</option>
              </select>
              <select
                value={ncrnaEdgeFilters.fda}
                onChange={(e) => onNcrnaEdgeFiltersChange({ fda: e.target.value })}
              >
                <option value="">All FDA labels</option>
                <option value="approved">approved</option>
                <option value="NA">NA</option>
              </select>
              <button onClick={onNcrnaEdgeSearch}>Search ncRNA Relationships</button>
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
            <h3>Disease Network Result Overview</h3>
          <div className="db-panel-subtitle">Release statistics, source-table inventory, and structured result summaries for the current disease network atlas version.</div>
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
            <strong>{diseaseSpotlights.length + drugSpotlights.length + targetSpotlights.length + (ncrnaOverview ? 2 : 0) + (ncrnaLinkedOverview ? 3 : 0)}</strong>
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
        {ncrnaOverview ? (
          <div className="db-research-grid db-stack-gap" ref={ncrnaSectionRef}>
            <div className="dti-heatmap-card target-module-card">
              <div className="dti-heatmap-head">
                <strong>Disease-Context Evidence Tables</strong>
                <span>The curated ncRNA-drug layer is retained as a disease-context evidence module alongside the prediction workflow. The tables below focus on how that evidence supports disease-centered interpretation.</span>
              </div>
              <div className="layer-legend-strip">
                <span className="layer-legend-pill is-known-only">
                  <strong>Known disease-context layer</strong>
                  <em>Curated ncRNA-drug rows</em>
                </span>
                <span className="layer-legend-pill is-release-layer">
                  <strong>Released prediction layer</strong>
                  <em>Formal disease-network result tables</em>
                </span>
                <span className="layer-legend-pill is-cross-layer">
                  <strong>Cross-layer linkage</strong>
                  <em>Shared drugs expose overlap between both layers</em>
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {ncrnaOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="result-table-wrap target-module-table">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>ncRNA evidence metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Human ncRNA-drug evidence rows</td><td><span className="result-emphasis-number">{ncrnaOverview.evidence_rows}</span></td></tr>
                  <tr><td>Unique ncRNA-drug edges</td><td><span className="result-emphasis-number">{ncrnaOverview.unique_edges}</span></td></tr>
                  <tr><td>Unique ncRNA entries</td><td><span className="result-emphasis-number">{ncrnaOverview.unique_ncrnas}</span></td></tr>
                  <tr><td>Unique drug entries</td><td><span className="result-emphasis-number">{ncrnaOverview.unique_drugs}</span></td></tr>
                  <tr><td>Distinct DrugBank IDs</td><td><span className="result-emphasis-number">{ncrnaOverview.unique_drugbank_ids}</span></td></tr>
                  <tr><td>Top ncRNA type</td><td>{ncrnaOverview.top_ncrna_type || "NA"}</td></tr>
                  <tr><td>Top relation category</td><td>{ncrnaOverview.top_relation_category || "NA"}</td></tr>
                  <tr><td>Approved-labeled evidence rows</td><td><span className="result-emphasis-number">{ncrnaOverview.approved_rows || 0}</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Top ncRNA</th>
                    <th>Type</th>
                    <th>Evidence rows</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaTopNcrnas.length ? ncrnaTopNcrnas.slice(0, 12).map((row) => (
                    <tr key={row.ncRNA_Name}>
                      <td>{row.ncrna_id ? (
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.ncrna_id)}>
                          <span className="result-emphasis-label">{row.ncRNA_Name}</span>
                        </button>
                      ) : <span className="result-emphasis-label">{row.ncRNA_Name}</span>}</td>
                      <td>{row.ncRNA_Type}</td>
                      <td><span className="result-emphasis-number">{row.evidence_rows}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3}>No ncRNA summary rows are available for the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Top drug in ncRNA layer</th>
                    <th>DrugBank ID</th>
                    <th>Evidence rows</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaTopDrugs.length ? ncrnaTopDrugs.slice(0, 12).map((row) => (
                    <tr key={`${row.Drug_Name}-${row.DrugBank_ID || "NA"}`}>
                      <td>{row.DrugBank_ID ? (
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.DrugBank_ID)}>
                          <span className="result-emphasis-label">{row.Drug_Name}</span>
                        </button>
                      ) : <span className="result-emphasis-label">{row.Drug_Name}</span>}</td>
                      <td>{row.DrugBank_ID || "-"}</td>
                      <td><span className="result-emphasis-number">{row.evidence_rows}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3}>No ncRNA-drug summary rows are available for the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ncrnaOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>ncRNA type</th>
                    <th>Evidence rows</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaTypeDistribution.length ? ncrnaTypeDistribution.map((row) => (
                    <tr key={row.ncrna_type}>
                      <td>{row.ncrna_type}</td>
                      <td>{row.count}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2}>No ncRNA-type distribution is available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>Curated relation</th>
                    <th>Evidence rows</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaRelationDistribution.length ? ncrnaRelationDistribution.map((row) => (
                    <tr key={row.relation_category}>
                      <td>{row.relation_category}</td>
                      <td>{row.count}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2}>No ncRNA relation summary is available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ttdOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>TTD Therapeutic Target Validation</strong>
                <span>Therapeutic Target Database rows provide external target-drug-disease and mode-of-action support for interpreting released disease-network results.</span>
              </div>
              <div className="layer-legend-strip">
                <span className="layer-legend-pill is-known-only">
                  <strong>TTD input layer</strong>
                  <em>Known target-drug-disease and MOA rows</em>
                </span>
                <span className="layer-legend-pill is-cross-layer">
                  <strong>Validation overlap</strong>
                  <em>Released rows sharing drug, target, or disease mappings with TTD</em>
                </span>
                <span className="layer-legend-pill is-release-layer">
                  <strong>Released output</strong>
                  <em>TTD-supported drugs, targets, and retained rows</em>
                </span>
              </div>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_targets}</strong>
                <em>TTD targets</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_drugs}</strong>
                <em>TTD drugs</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_supported_released_rows}</strong>
                <em>TTD-supported released rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_drug_disease_supported_rows}</strong>
                <em>Drug-disease supported rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_target_disease_supported_rows}</strong>
                <em>Target-disease supported rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.top_moa || "NA"}</strong>
                <em>Leading TTD MOA</em>
              </span>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>TTD validation metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>TTD target count</td><td><span className="result-emphasis-number">{ttdOverview.ttd_targets}</span></td></tr>
                  <tr><td>TTD drug count</td><td><span className="result-emphasis-number">{ttdOverview.ttd_drugs}</span></td></tr>
                  <tr><td>TTD cross-matched drugs</td><td><span className="result-emphasis-number">{ttdOverview.ttd_crossmatched_drugs}</span></td></tr>
                  <tr><td>Drug-disease mapping rows</td><td><span className="result-emphasis-number">{ttdOverview.ttd_drug_disease_rows}</span></td></tr>
                  <tr><td>Target-disease mapping rows</td><td><span className="result-emphasis-number">{ttdOverview.ttd_target_disease_rows}</span></td></tr>
                  <tr><td>Drug-target MOA rows</td><td><span className="result-emphasis-number">{ttdOverview.ttd_drug_target_moa_rows}</span></td></tr>
                  <tr><td>TTD-supported released rows</td><td><span className="result-emphasis-number">{ttdOverview.ttd_supported_released_rows}</span></td></tr>
                  <tr><td>Top target type</td><td>{ttdOverview.top_target_type || "NA"}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>TTD-supported drug</th>
                    <th>Released rows</th>
                    <th>Consensus rows</th>
                    <th>Avg TXGNN</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdTopSupportedDrugs.length ? ttdTopSupportedDrugs.slice(0, 12).map((row) => (
                    <tr key={`${row.Drug_ID}-${row.Drug_Name}`}>
                      <td>{row.Drug_ID ? (
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.Drug_ID)}>
                          <span className="result-emphasis-label">{row.Drug_Name}</span>
                        </button>
                      ) : <span className="result-emphasis-label">{row.Drug_Name}</span>}</td>
                      <td><span className="result-emphasis-number">{row.released_rows}</span></td>
                      <td>{row.consensus_rows}</td>
                      <td>{Number(row.avg_txgnn || 0).toFixed(4)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}>No TTD-supported released drugs are available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>TTD-supported target</th>
                    <th>Released rows</th>
                    <th>Consensus rows</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdTopSupportedTargets.length ? ttdTopSupportedTargets.slice(0, 12).map((row) => (
                    <tr key={`${row.Target_ID}-${row.gene_name}`}>
                      <td>{row.Target_ID ? (
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.Target_ID)}>
                          <span className="result-emphasis-label">{row.gene_name || row.Target_ID}</span>
                        </button>
                      ) : <span className="result-emphasis-label">{row.gene_name || row.Target_ID}</span>}</td>
                      <td><span className="result-emphasis-number">{row.released_rows}</span></td>
                      <td>{row.consensus_rows}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3}>No TTD-supported released targets are available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ttdOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>TTD target type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdTargetTypeDistribution.length ? ttdTargetTypeDistribution.slice(0, 10).map((row) => (
                    <tr key={row.target_type}>
                      <td>{row.target_type}</td>
                      <td>{row.count}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2}>No TTD target-type distribution is available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>TTD drug status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdDrugStatusDistribution.length ? ttdDrugStatusDistribution.slice(0, 10).map((row) => (
                    <tr key={row.status_label}>
                      <td>{row.status_label}</td>
                      <td>{row.count}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2}>No TTD drug-status distribution is available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>TTD MOA</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdMoaDistribution.length ? ttdMoaDistribution.slice(0, 10).map((row) => (
                    <tr key={row.moa_label}>
                      <td>{row.moa_label}</td>
                      <td>{row.count}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2}>No TTD MOA distribution is available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ttdSupportedOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>TTD-Supported Released Results</strong>
                <span>These tables isolate the released rows that also receive external support from TTD target-drug-disease knowledge, with consensus and approved subsets broken out for direct review.</span>
              </div>
              <div className="result-summary-strip">
                <span className="result-summary-pill">
                  <strong>{ttdSupportedOverview.released_row_count}</strong>
                  <em>TTD-supported released rows</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{ttdSupportedOverview.consensus_row_count}</strong>
                  <em>TTD-supported consensus rows</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{ttdSupportedOverview.approved_row_count}</strong>
                  <em>TTD-supported approved rows</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{ttdSupportedOverview.top_moa || "NA"}</strong>
                  <em>Leading MOA in supported rows</em>
                </span>
              </div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>TTD-supported consensus case</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>TTD support</th>
                    <th>MOA</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdSupportedConsensusCases.length ? ttdSupportedConsensusCases.map((row) => (
                    <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                      <td><button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}><span className="result-emphasis-label">{row.drug_label}</span></button></td>
                      <td><button className="result-link-btn" onClick={() => onJumpToNode(row.target_id)}>{row.target_label}</button></td>
                      <td><button className="result-link-btn" onClick={() => onJumpToNode(row.disease_id)}>{row.disease_label}</button></td>
                      <td><span className="result-emphasis-chip is-soft">{row.ttd_support_label}</span></td>
                      <td>{row.ttd_moa || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No consensus rows are currently cross-supported by TTD in this release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>TTD-supported approved row</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>TTD support</th>
                    <th>MOA</th>
                  </tr>
                </thead>
                <tbody>
                  {ttdSupportedApprovedRows.length ? ttdSupportedApprovedRows.map((row) => (
                    <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                      <td><button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}><span className="result-emphasis-label">{row.drug_label}</span></button></td>
                      <td><button className="result-link-btn" onClick={() => onJumpToNode(row.target_id)}>{row.target_label}</button></td>
                      <td><button className="result-link-btn" onClick={() => onJumpToNode(row.disease_id)}>{row.disease_label}</button></td>
                      <td><span className="result-emphasis-chip is-soft">{row.ttd_support_label}</span></td>
                      <td>{row.ttd_moa || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No approved rows are currently cross-supported by TTD in this release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {targetCentricOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>Therapeutic Target Module</strong>
                <span>Target-centered result browsing aligned with therapeutic target databases: each row keeps the released disease-network context while surfacing the dominant drug, disease, and TTD/MOA support around the same target.</span>
              </div>
              <div className="result-summary-strip">
                <span className="result-summary-pill">
                  <strong>{targetCentricOverview.selected_target_count}</strong>
                  <em>Selected targets</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{targetCentricOverview.ttd_supported_target_count}</strong>
                  <em>TTD-supported targets</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{targetCentricOverview.consensus_supported_target_count}</strong>
                  <em>Consensus-linked targets</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{targetCentricOverview.leading_moa || "NA"}</strong>
                  <em>Leading MOA</em>
                </span>
              </div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Released rows</th>
                    <th>Top disease</th>
                    <th>Top drug</th>
                    <th>TTD support</th>
                    <th>MOA</th>
                  </tr>
                </thead>
                <tbody>
                  {targetCentricRows.length ? targetCentricRows.map((row) => (
                    <tr key={row.target_id}>
                      <td><button className="result-link-btn" onClick={() => setSelectedTargetDetail(row)}><span className="result-emphasis-label">{row.target_label}</span></button></td>
                      <td><span className="result-emphasis-number">{row.released_rows}</span></td>
                      <td>{row.top_disease_label || "-"}</td>
                      <td>{row.top_drug_label || "-"}</td>
                      <td>{row.top_ttd_support ? <span className="result-emphasis-chip is-soft">{row.top_ttd_support}</span> : "-"}</td>
                      <td>{row.top_ttd_moa || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}>No therapeutic target module rows are available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {selectedTargetDetail ? (
              <div className="dti-heatmap-card target-detail-card">
                <div className="dti-heatmap-head">
                  <strong>Selected Target Detail</strong>
                  <span>A structured target-centric detail card for the currently selected therapeutic target, combining released-network reach with disease, drug, and TTD/MOA context.</span>
                </div>
                <div className="result-summary-strip target-detail-summary">
                  <span className="result-summary-pill">
                    <strong>{selectedTargetDetail.target_label}</strong>
                    <em>{selectedTargetDetail.target_id}</em>
                  </span>
                  <span className="result-summary-pill">
                    <strong>{selectedTargetDetail.released_rows}</strong>
                    <em>Released rows</em>
                  </span>
                  <span className="result-summary-pill">
                    <strong>{selectedTargetDetail.consensus_rows}</strong>
                    <em>Consensus rows</em>
                  </span>
                  <span className="result-summary-pill">
                    <strong>{selectedTargetDetail.top_ttd_moa || "NA"}</strong>
                    <em>Leading MOA</em>
                  </span>
                </div>
                <div className="comparison-grid target-detail-grid">
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">Top Disease Context</div>
                    <div className="item-meta">{selectedTargetDetail.top_disease_label || "No dominant disease available."}</div>
                  </div>
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">Top Drug Context</div>
                    <div className="item-meta">{selectedTargetDetail.top_drug_label || "No dominant drug available."}</div>
                  </div>
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">TTD Support</div>
                    <div className="item-meta">{selectedTargetDetail.top_ttd_support || "No TTD support label available."}</div>
                  </div>
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">Best Released Support</div>
                    <div className="item-meta">{selectedTargetDetail.max_algo_pass || 0}/3 released support and {selectedTargetDetail.max_votes || 0}/7 seven-model vote support</div>
                    <div className="comparison-actions">
                      <button className="primary" onClick={() => onJumpToNode(selectedTargetDetail.target_id)}>View in Network</button>
                    </div>
                  </div>
                </div>
                <div className="result-table-wrap target-detail-table">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>Linked released row</th>
                        <th>Disease</th>
                        <th>TTD support</th>
                        <th>MOA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTargetDetail.top_linked_rows || []).length ? selectedTargetDetail.top_linked_rows.map((row, idx) => (
                        <tr key={`${row.drug_id}-${row.disease_id}-${idx}`}>
                          <td>{row.drug_id ? <button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}>{row.drug_label}</button> : (row.drug_label || "-")}</td>
                          <td>{row.disease_id ? <button className="result-link-btn" onClick={() => onJumpToNode(row.disease_id)}>{row.disease_label}</button> : (row.disease_label || "-")}</td>
                          <td>{row.ttd_support_label ? <span className="result-emphasis-chip is-soft">{row.ttd_support_label}</span> : "-"}</td>
                          <td>{row.ttd_moa || "-"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>No linked released rows are available for the selected target.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {ncrnaLinkedOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>Disease-Linked Released Context</strong>
                <span>These summary tables capture where the formal released prediction layer and the curated disease-context evidence layer intersect through shared drugs.</span>
              </div>
              <div className="layer-legend-strip">
                <span className="layer-legend-pill is-known-only">
                  <strong>Known evidence input</strong>
                  <em>Curated disease-context rows</em>
                </span>
                <span className="layer-legend-pill is-cross-layer">
                  <strong>Linking rule</strong>
                  <em>Shared-drug overlap</em>
                </span>
                <span className="layer-legend-pill is-release-layer">
                  <strong>Released result output</strong>
                  <em>Released, consensus, and approved rows</em>
                </span>
              </div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table compact">
                <thead>
                  <tr>
                    <th>ncRNA-linked metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Released rows linked to ncRNA evidence</td><td><span className="result-emphasis-number">{ncrnaLinkedOverview.released_row_count || 0}</span></td></tr>
                  <tr><td>Consensus rows linked to ncRNA evidence</td><td><span className="result-emphasis-number">{ncrnaLinkedOverview.consensus_row_count || 0}</span></td></tr>
                  <tr><td>Selected approved-drug rows linked to ncRNA evidence</td><td><span className="result-emphasis-number">{ncrnaLinkedOverview.selected_approved_row_count || 0}</span></td></tr>
                  <tr><td>Released drugs shared with ncRNA layer</td><td><span className="result-emphasis-number">{ncrnaLinkedOverview.linked_drug_count || 0}</span></td></tr>
                  <tr><td>ncRNAs connected to released drugs</td><td><span className="result-emphasis-number">{ncrnaLinkedOverview.linked_ncrna_count || 0}</span></td></tr>
                  <tr><td>Top relation category</td><td>{ncrnaLinkedOverview.top_relation_category || "NA"}</td></tr>
                  <tr><td>Top ncRNA type</td><td>{ncrnaLinkedOverview.top_ncrna_type || "NA"}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Linked drug</th>
                    <th>Released rows</th>
                    <th>Linked ncRNAs</th>
                    <th>Support</th>
                    <th>Top ncRNA</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaLinkedDrugs.length ? ncrnaLinkedDrugs.map((row) => (
                    <tr key={row.drug_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}>
                          <span className="result-emphasis-label">{row.drug_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{row.released_row_count}</span></td>
                      <td>{row.linked_ncrna_count}</td>
                      <td><span className="result-emphasis-chip">{row.max_algo_pass}/3 · {row.max_votes}/7</span></td>
                      <td>{row.top_ncrna_name || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No released-result overlap with the ncRNA layer is available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Linked consensus row</th>
                    <th>Disease</th>
                    <th>Top ncRNA</th>
                    <th>Support</th>
                    <th>TXGNN</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaLinkedConsensusCases.length ? ncrnaLinkedConsensusCases.map((row) => (
                    <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                      <td>
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}>
                          <span className="result-emphasis-label">{row.drug_label}</span>
                        </button>
                      </td>
                      <td>{row.disease_label}</td>
                      <td>{row.top_ncrna_name || "-"}</td>
                      <td><span className="result-emphasis-chip">{row.n_algo_pass}/3 · {row.Total_Votes_Optional7}/7</span></td>
                      <td>{row.TXGNN_score ?? "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No consensus rows currently overlap with curated ncRNA-drug evidence.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ncrnaLinkedOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Selected approved-drug row</th>
                    <th>Disease</th>
                    <th>Top ncRNA</th>
                    <th>Support</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrnaLinkedApprovedRows.length ? ncrnaLinkedApprovedRows.map((row) => (
                    <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                      <td>
                        <button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}>
                          <span className="result-emphasis-label">{row.drug_label}</span>
                        </button>
                      </td>
                      <td>{row.disease_label}</td>
                      <td>{row.top_ncrna_name || "-"}</td>
                      <td><span className="result-emphasis-chip">{row.n_algo_pass}/3 · {row.Total_Votes_Optional7}/7</span></td>
                      <td>{row.ENR_FDR ?? "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No selected approved-drug rows currently overlap with curated ncRNA-drug evidence.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
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
                    <tr><td>Release-filtered DTI pairs</td><td><span className="result-emphasis-number">{pipelineShrinkage.release_filtered_pairs || pipelineShrinkage.vote4_retained}</span></td></tr>
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
          {releasedDtiAudit?.release_filtered_pairs ? (
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{releasedDtiAudit.release_filtered_pairs.toLocaleString()}</strong>
                <em>Release-filtered DTI pairs</em>
              </span>
              <span className="result-summary-pill">
                <strong>{releasedDtiAudit.released_prediction_rows.toLocaleString()}</strong>
                <em>Released prediction rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{releasedDtiAudit.curated_overlap_rows.toLocaleString()}</strong>
                <em>Curated overlap rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{releasedDtiAudit.additional_released_pairs.toLocaleString()}</strong>
                <em>Additional released pairs</em>
              </span>
            </div>
          ) : null}
          {releasedDtiAudit?.coverage_note ? (
            <div className="network-caption">{releasedDtiAudit.coverage_note}</div>
          ) : null}
          {releasedDtiTtdSummary?.release_filtered_pairs ? (
            <>
              <div className="result-summary-strip">
                <span className="result-summary-pill">
                  <strong>{releasedDtiTtdSummary.ttd_supported_pairs.toLocaleString()}</strong>
                  <em>TTD-supported released pairs</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{releasedDtiTtdSummary.ttd_supported_pair_pct}%</strong>
                  <em>Pair-level TTD support</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{releasedDtiTtdSummary.top_pair_moa || "NA"}</strong>
                  <em>Leading MOA</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{releasedDtiTtdSummary.ttd_supported_released_rows.toLocaleString()}</strong>
                  <em>TTD-supported released rows</em>
                </span>
              </div>
              <div className="home-research-grid inner-result-grid">
                <div className="result-table-wrap">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>TTD-supported drug</th>
                        <th>Pairs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(releasedDtiTtdSummary.top_supported_pair_drugs || []).length ? releasedDtiTtdSummary.top_supported_pair_drugs.slice(0, 8).map((item) => (
                        <tr key={item.Drug_ID}>
                          <td><button className="result-link-btn" onClick={() => onJumpToNode(item.Drug_ID)}><span className="result-emphasis-label">{item.Drug_Name}</span></button></td>
                          <td><span className="result-emphasis-number">{item.pair_count}</span></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2}>No direct TTD-supported pair summary is available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="result-table-wrap">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>TTD-supported target</th>
                        <th>Pairs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(releasedDtiTtdSummary.top_supported_pair_targets || []).length ? releasedDtiTtdSummary.top_supported_pair_targets.slice(0, 8).map((item) => (
                        <tr key={item.Target_ID}>
                          <td><button className="result-link-btn" onClick={() => onJumpToNode(item.Target_ID)}><span className="result-emphasis-label">{item.gene_name || item.Target_ID}</span></button></td>
                          <td><span className="result-emphasis-number">{item.pair_count}</span></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2}>No target-level TTD support is available for the current released pair layer.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="network-caption">{releasedDtiTtdSummary.coverage_note}</div>
            </>
          ) : null}
          {releasedDiseaseSummary?.released_rows ? (
            <>
              <div className="result-summary-strip">
                <span className="result-summary-pill">
                  <strong>{releasedDiseaseSummary.released_rows.toLocaleString()}</strong>
                  <em>Released disease-linked rows</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{releasedDiseaseSummary.released_pairs.toLocaleString()}</strong>
                  <em>Released disease-linked pairs</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{releasedDiseaseSummary.released_unique_targets.toLocaleString()}</strong>
                  <em>Targets represented</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{releasedDiseaseSummary.top_support_pattern || "NA"}</strong>
                  <em>Leading inferred support pattern</em>
                </span>
              </div>
              <div className="home-research-grid inner-result-grid">
                <div className="result-table-wrap">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>Released disease-linked row</th>
                        <th>Target</th>
                        <th>Disease</th>
                        <th>Support</th>
                        <th>TXGNN score</th>
                        <th>ENR FDR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(releasedDiseaseSummary.top_rows || []).length ? releasedDiseaseSummary.top_rows.map((item) => (
                        <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}`}>
                          <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                          <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>{item.target_label}</button></td>
                          <td><button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>{item.disease_label}</button></td>
                          <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                          <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                          <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6}>No released disease-linked rows are available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="result-table-wrap">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>Released target</th>
                        <th>Rows</th>
                        <th>Top disease</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(releasedDiseaseSummary.top_targets || []).length ? releasedDiseaseSummary.top_targets.slice(0, 8).map((item, idx) => {
                        const topDisease = (releasedDiseaseSummary.top_rows || []).find((row) => row.target_id === item.target_id)?.disease_label || "-";
                        return (
                          <tr key={`${item.target_id}-${idx}`}>
                            <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}><span className="result-emphasis-label">{item.gene_name || item.target_label}</span></button></td>
                            <td><span className="result-emphasis-number">{item.row_count}</span></td>
                            <td>{topDisease}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={3}>No target summary is available for the current released layer.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="network-caption">{releasedDiseaseSummary.coverage_note}</div>
            </>
          ) : null}
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
                  <th>ncRNA-supported drug</th>
                  <th>Best support</th>
                </tr>
              </thead>
              <tbody>
                {diseaseSpotlights.length ? diseaseSpotlights.map((item) => {
                  const linked = ncrnaLinkedDrugMap[item.top_drug_id];
                  const detail = diseaseCentricMap[item.disease_id];
                  return (
                  <tr key={item.disease_id}>
                    <td><button className="result-link-btn" onClick={() => setSelectedDiseaseDetail(detail || {
                      disease_id: item.disease_id,
                      disease_label: item.disease_label,
                      released_rows: item.row_count,
                      top_drug_id: item.top_drug_id,
                      top_drug_label: item.top_drug_label,
                      top_target_label: item.top_target_label,
                      max_algo_pass: item.max_algo_pass,
                      max_votes: item.max_votes,
                      top_linked_rows: [],
                    })}><span className="result-emphasis-label">{item.disease_label}</span></button></td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td>{item.top_drug_label || "-"}</td>
                    <td>{item.top_target_label || "-"}</td>
                    <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                  </tr>
                )}) : (
                  <tr><td colSpan={6}>No disease summary rows are available in the current release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {diseaseCentricOverview ? (
          <div className="db-research-grid db-stack-gap">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>Disease Context Module</strong>
                <span>Disease-centered object browsing aligned with the released disease network: each row captures the dominant drug, target, ncRNA-linked context, and TTD-supported target context around the same disease node.</span>
              </div>
              <div className="result-summary-strip">
                <span className="result-summary-pill">
                  <strong>{diseaseCentricOverview.selected_disease_count}</strong>
                  <em>Selected diseases</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{diseaseCentricOverview.ncrna_context_count}</strong>
                  <em>With ncRNA context</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{diseaseCentricOverview.ttd_context_count}</strong>
                  <em>With TTD context</em>
                </span>
                <span className="result-summary-pill">
                  <strong>{diseaseCentricOverview.leading_drug || "NA"}</strong>
                  <em>Leading drug context</em>
                </span>
              </div>
            </div>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Disease</th>
                    <th>Released rows</th>
                    <th>Top drug</th>
                    <th>Top target</th>
                    <th>ncRNA context</th>
                    <th>TTD context</th>
                  </tr>
                </thead>
                <tbody>
                  {diseaseCentricRows.length ? diseaseCentricRows.map((row) => (
                    <tr key={row.disease_id}>
                      <td><button className="result-link-btn" onClick={() => setSelectedDiseaseDetail(row)}><span className="result-emphasis-label">{row.disease_label}</span></button></td>
                      <td><span className="result-emphasis-number">{row.released_rows}</span></td>
                      <td>{row.top_drug_label || "-"}</td>
                      <td>{row.top_target_label || "-"}</td>
                      <td>{row.ncrna_summary ? <span className="result-emphasis-chip is-soft">{row.ncrna_summary}</span> : "-"}</td>
                      <td>{row.ttd_summary ? <span className="result-emphasis-chip is-soft">{row.ttd_summary}</span> : "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}>No disease-centric rows are available in the current release.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {selectedDiseaseDetail ? (
              <div className="dti-heatmap-card target-detail-card">
                <div className="dti-heatmap-head">
                  <strong>Selected Disease Detail</strong>
                  <span>A structured disease-centric detail card for the currently selected disease node, combining released-network reach with drug, target, ncRNA, and TTD context.</span>
                </div>
                <div className="result-summary-strip target-detail-summary">
                  <span className="result-summary-pill">
                    <strong>{selectedDiseaseDetail.disease_label}</strong>
                    <em>{selectedDiseaseDetail.disease_id}</em>
                  </span>
                  <span className="result-summary-pill">
                    <strong>{selectedDiseaseDetail.released_rows}</strong>
                    <em>Released rows</em>
                  </span>
                  <span className="result-summary-pill">
                    <strong>{selectedDiseaseDetail.max_algo_pass || 0}/3</strong>
                    <em>Best released support</em>
                  </span>
                  <span className="result-summary-pill">
                    <strong>{selectedDiseaseDetail.max_votes || 0}/7</strong>
                    <em>Best vote support</em>
                  </span>
                </div>
                <div className="comparison-grid target-detail-grid">
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">Top Drug Context</div>
                    <div className="item-meta">{selectedDiseaseDetail.drug_summary || selectedDiseaseDetail.top_drug_label || "No dominant drug available."}</div>
                  </div>
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">Top Target Context</div>
                    <div className="item-meta">{selectedDiseaseDetail.target_summary || selectedDiseaseDetail.top_target_label || "No dominant target available."}</div>
                  </div>
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">Top ncRNA-Linked Drug Context</div>
                    <div className="item-meta">{selectedDiseaseDetail.ncrna_summary || "No ncRNA-linked context available."}</div>
                  </div>
                  <div className="comparison-card target-detail-panel">
                    <div className="annot-title">TTD-Supported Target Context</div>
                    <div className="item-meta">{selectedDiseaseDetail.ttd_summary || "No TTD-supported context available."}</div>
                    <div className="comparison-actions">
                      <button className="primary" onClick={() => onJumpToNode(selectedDiseaseDetail.disease_id)}>View in Network</button>
                    </div>
                  </div>
                </div>
                <div className="result-table-wrap target-detail-table">
                  <table className="result-table compact">
                    <thead>
                      <tr>
                        <th>Linked released row</th>
                        <th>Target</th>
                        <th>Support</th>
                        <th>Pattern</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedDiseaseDetail.top_linked_rows || []).length ? selectedDiseaseDetail.top_linked_rows.map((row, idx) => (
                        <tr key={`${row.drug_id}-${row.target_id}-${idx}`}>
                          <td>{row.drug_id ? <button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id)}>{row.drug_label}</button> : (row.drug_label || "-")}</td>
                          <td>{row.target_id ? <button className="result-link-btn" onClick={() => onJumpToNode(row.target_id)}>{row.target_label}</button> : (row.target_label || "-")}</td>
                          <td><span className="result-emphasis-chip">{row.n_algo_pass || 0}/3 · {row.Total_Votes_Optional7 || 0}/7</span></td>
                          <td>{row.support_pattern || "-"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>No linked released rows are available for the selected disease.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="db-research-grid db-stack-gap">
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>Released-method consistency</strong>
              <span>The released disease network retains rows through TXGNN, ENR, and RWR agreement patterns.</span>
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
                    <td>{item.disease_label || "Retained in network release"}</td>
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
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>Consensus Result Table</strong>
              <span>High-consensus released rows are additionally checked against curated ncRNA-drug evidence through shared drugs, so ncRNA-linked consensus coverage can be reviewed before reading the full table.</span>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{consensusNcRnaSummary.linked_row_count}</strong>
                <em>Consensus rows with ncRNA support</em>
              </span>
              <span className="result-summary-pill">
                <strong>{consensusNcRnaSummary.linked_drug_count}</strong>
                <em>Consensus drugs shared with the ncRNA layer</em>
              </span>
              <span className="result-summary-pill">
                <strong>{consensusNcRnaSummary.linked_ncrna_count}</strong>
                <em>Linked ncRNAs represented in consensus rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{consensusNcRnaSummary.top_ncrna_name || "NA"}</strong>
                <em>Leading ncRNA across consensus-linked rows</em>
              </span>
            </div>
          </div>
          <div className="result-table-wrap">
            <table className="result-table">
                <thead>
                  <tr>
                    <th>High-consensus case</th>
                    <th>Target</th>
                    <th>Disease</th>
                    <th>Support</th>
                    <th>ncRNA link</th>
                    <th>TTD support</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                {highConsensusCases.length ? highConsensusCases.map((item, idx) => {
                  const linked = ncrnaLinkedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`];
                  const ttd = ttdSupportedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`];
                  return (
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
                    <td>
                      {linked ? (
                        <span className="result-emphasis-chip is-soft">
                          {linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}
                        </span>
                      ) : "-"}
                    </td>
                    <td>{ttd ? <span className="result-emphasis-chip is-soft">{ttd.ttd_support_label}</span> : "-"}</td>
                    <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                    <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                  </tr>
                )}) : (
                  <tr><td colSpan={8}>No high-consensus results are available for the current release.</td></tr>
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
                    <th>ncRNA link</th>
                    <th>TTD support</th>
                    <th>Top TXGNN score</th>
                    <th>Best ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                {approvedDrugDeepResults.length ? approvedDrugDeepResults.map((item) => {
                  const linked = ncrnaLinkedDrugMap[item.drug_id];
                  const ttd = ttdSupportedApprovedRows.find((row) => row.drug_id === item.drug_id);
                  return (
                  <tr key={item.drug_id}>
                    <td>
                      <button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}>
                        <span className="result-emphasis-label">{item.drug_label}</span>
                      </button>
                    </td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3</span></td>
                    <td><span className="result-emphasis-chip is-soft">{item.max_votes}/7</span></td>
                    <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                    <td>{ttd ? <span className="result-emphasis-chip is-soft">{ttd.ttd_support_label}</span> : "-"}</td>
                    <td><span className="result-emphasis-number">{item.top_txgnn_score ?? "-"}</span></td>
                    <td>{item.best_enr_fdr != null ? <span className="result-emphasis-chip is-soft">{item.best_enr_fdr}</span> : "-"}</td>
                  </tr>
                )}) : (
                  <tr><td colSpan={8}>No approved-drug result rows are available in the current release.</td></tr>
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
                  <th>Cross-associated diseases</th>
                  <th>Top target</th>
                  <th>ncRNA-supported</th>
                  <th>Best support</th>
                </tr>
              </thead>
              <tbody>
                {drugSpotlights.length ? drugSpotlights.map((item) => {
                  const linked = ncrnaLinkedDrugMap[item.drug_id];
                  return (
                  <tr key={item.drug_id}>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                    <td><span className="result-emphasis-number">{item.row_count}</span></td>
                    <td>{item.top_disease_label || "-"}</td>
                    <td><span className="result-muted-multiline">{item.disease_summary || item.top_disease_label || "-"}</span></td>
                    <td>{item.top_target_label || "-"}</td>
                    <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                  </tr>
                )}) : <tr><td colSpan={7}>No drug summary rows are available in the current release.</td></tr>}
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
                  <th>Cross-associated diseases</th>
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
                    <td><span className="result-muted-multiline">{item.disease_summary || item.top_disease_label || "-"}</span></td>
                    <td>{item.top_drug_label || "-"}</td>
                    <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                  </tr>
                )) : <tr><td colSpan={6}>No target summary rows are available in the current release.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="db-research-grid db-stack-gap">
          <div className="dti-heatmap-card">
            <div className="dti-heatmap-head">
              <strong>Approved Drug Result Table</strong>
              <span>Approved-drug priority rows are cross-checked against the curated ncRNA layer so the overlap with known ncRNA-drug evidence remains visible at the same level as support scores and disease assignments.</span>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{approvedNcRnaSummary.linked_row_count}</strong>
                <em>Approved rows with ncRNA support</em>
              </span>
              <span className="result-summary-pill">
                <strong>{approvedNcRnaSummary.linked_drug_count}</strong>
                <em>Approved drugs shared with the ncRNA layer</em>
              </span>
              <span className="result-summary-pill">
                <strong>{approvedNcRnaSummary.linked_ncrna_count}</strong>
                <em>Linked ncRNAs represented in approved rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{approvedNcRnaSummary.top_ncrna_name || "NA"}</strong>
                <em>Leading ncRNA across approved-linked rows</em>
              </span>
            </div>
          </div>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Consensus priority</th>
                  <th>Target</th>
                  <th>Disease</th>
                  <th>Support</th>
                  <th>ncRNA link</th>
                  <th>TXGNN score</th>
                  <th>ENR FDR</th>
                </tr>
              </thead>
              <tbody>
                {topConsensusLeaderboard.length ? topConsensusLeaderboard.map((item, idx) => {
                  const linked = ncrnaLinkedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`];
                  return (
                  <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>{item.target_label}</button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>{item.disease_label}</button></td>
                    <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                    <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                    <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                    <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                  </tr>
                )}) : <tr><td colSpan={7}>No consensus priority rows are available in the current release.</td></tr>}
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
                  <th>ncRNA link</th>
                  <th>TXGNN score</th>
                  <th>ENR FDR</th>
                </tr>
              </thead>
              <tbody>
                {topApprovedLeaderboard.length ? topApprovedLeaderboard.map((item, idx) => {
                  const linked = ncrnaLinkedApprovedMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`] || ncrnaLinkedDrugMap[item.drug_id];
                  return (
                  <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.target_id)}>{item.target_label}</button></td>
                    <td><button className="result-link-btn" onClick={() => onJumpToNode(item.disease_id)}>{item.disease_label}</button></td>
                    <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                    <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                    <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                    <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                  </tr>
                )}) : <tr><td colSpan={7}>No approved priority rows are available in the current release.</td></tr>}
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

      <section className="card panel-pad db-panel db-stack-gap" ref={ncrnaSectionRef}>
        <div className="db-panel-head">
          <div>
            <h3>ncRNA Evidence Table</h3>
            <div className="db-panel-subtitle">Curated human-known ncRNA-drug evidence rows retained as a formal known-only release module.</div>
          </div>
          <div className="muted">page {ncrnaEvidenceState.page} · size {ncrnaEvidenceState.page_size} · total {ncrnaEvidenceState.total}</div>
        </div>
        <div className="result-table-wrap edge-result-wrap">
          {ncrnaEvidenceState.items.length ? (
            <table className="result-table edge-result-table">
              <thead>
                <tr>
                  <th>ncRNA</th>
                  <th>Type</th>
                  <th>Drug</th>
                  <th>DrugBank ID</th>
                  <th>Curated relation</th>
                  <th>Phenotype</th>
                  <th>Condition</th>
                  <th>FDA</th>
                  <th>PMID</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {ncrnaEvidenceState.items.map((row, idx) => (
                  <tr key={`${row.ncRNA_Name}-${row.Drug_Name}-${row.PMID}-${idx}`}>
                    <td>{row.ncrna_id ? (
                      <button className="result-link-btn" onClick={() => onJumpToNode(row.ncrna_id)}>
                        <span className="result-emphasis-label">{row.ncRNA_Name}</span>
                      </button>
                    ) : <span className="result-emphasis-label">{row.ncRNA_Name}</span>}</td>
                    <td>{row.ncRNA_Type}</td>
                    <td>{row.DrugBank_ID ? (
                      <button className="result-link-btn" onClick={() => onJumpToNode(row.DrugBank_ID)}>
                        {row.Drug_Name}
                      </button>
                    ) : row.Drug_Name}</td>
                    <td>{row.DrugBank_ID || "-"}</td>
                    <td>{row.relation_category}</td>
                    <td>{row.Phenotype || "-"}</td>
                    <td>{row.Condition || "-"}</td>
                    <td>{row.FDA || "-"}</td>
                    <td>{row.PMID || "-"}</td>
                    <td>{row.Published_Year || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-state">No ncRNA evidence rows matched the current filters.</div>}
        </div>
        <div className="pager">
          <button onClick={() => onNcrnaEvidencePage(-1)} disabled={!canNcrnaEvidencePrev}>Previous</button>
          <span className="pager-status">Page {ncrnaEvidenceState.page}</span>
          <button onClick={() => onNcrnaEvidencePage(1)} disabled={!canNcrnaEvidenceNext}>Next Page</button>
        </div>
      </section>

      <section className="card panel-pad db-panel db-stack-gap">
        <div className="db-panel-head">
          <div>
            <h3>ncRNA-Drug Relationship Table</h3>
            <div className="db-panel-subtitle">Deduplicated ncRNA-drug relationships aggregated from the curated human evidence layer with phenotypes, methods, and evidence counts.</div>
          </div>
          <div className="muted">page {ncrnaEdgeState.page} · size {ncrnaEdgeState.page_size} · total {ncrnaEdgeState.total}</div>
        </div>
        <div className="result-table-wrap edge-result-wrap">
          {ncrnaEdgeState.items.length ? (
            <table className="result-table edge-result-table">
              <thead>
                <tr>
                  <th>ncRNA</th>
                  <th>Type</th>
                  <th>Drug</th>
                  <th>DrugBank ID</th>
                  <th>Evidence rows</th>
                  <th>PMIDs</th>
                  <th>Curated relation</th>
                  <th>Phenotypes</th>
                  <th>FDA</th>
                </tr>
              </thead>
              <tbody>
                {ncrnaEdgeState.items.map((row, idx) => (
                  <tr key={`${row.ncrna_id}-${row.drug_id_final}-${idx}`}>
                    <td>{row.ncrna_id ? (
                      <button className="result-link-btn" onClick={() => onJumpToNode(row.ncrna_id)}>
                        <span className="result-emphasis-label">{row.ncRNA_Name}</span>
                      </button>
                    ) : <span className="result-emphasis-label">{row.ncRNA_Name}</span>}</td>
                    <td>{row.ncRNA_Type}</td>
                    <td>{row.drug_id_final ? (
                      <button className="result-link-btn" onClick={() => onJumpToNode(row.drug_id_final)}>
                        {row.Drug_Name}
                      </button>
                    ) : row.Drug_Name}</td>
                    <td>{row.drug_id_final || row.DrugBank_ID || "-"}</td>
                    <td><span className="result-emphasis-number">{row.evidence_rows}</span></td>
                    <td>{row.unique_pmids}</td>
                    <td>{row.relation_categories}</td>
                    <td>{row.phenotypes || "-"}</td>
                    <td>{row.fda_status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-state">No ncRNA-drug relationship rows matched the current filters.</div>}
        </div>
        <div className="pager">
          <button onClick={() => onNcrnaEdgePage(-1)} disabled={!canNcrnaEdgePrev}>Previous</button>
          <span className="pager-status">Page {ncrnaEdgeState.page}</span>
          <button onClick={() => onNcrnaEdgePage(1)} disabled={!canNcrnaEdgeNext}>Next Page</button>
        </div>
      </section>
    </section>
  );
}
