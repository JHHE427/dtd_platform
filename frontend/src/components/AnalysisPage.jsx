import React from "react";
import GraphCanvas from "./GraphCanvas";

function renderEdgeStats(items) {
  if (!items?.length) return <div className="item muted">No edge stats</div>;
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
  compareState,
  onGraphSearchTextChange,
  onCenterNodeChange,
  onGraphModeChange,
  onPathStateChange,
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
  const comparison = compareState?.data || null;
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
  const nodeTypeMap = (graph?.nodes || []).reduce((acc, n) => {
    const k = n.node_type || "Other";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const drugCount = nodeTypeMap.Drug || 0;
  const targetCount = nodeTypeMap.Target || 0;
  const diseaseCount = nodeTypeMap.Disease || 0;
  const coveragePct = Math.round((profile.coverage_ratio || 0) * 100);

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
          <h2>Sensitivity Analysis Dashboard</h2>
          <div className="analysis-subtitle">Interactive Disease-Target-Drug atlas exploration with evidence-aware links</div>
        </div>
        <div className="toolbar">
          <select value={densityMode} onChange={(e) => onDensityModeChange(e.target.value)}>
            <option value="sparse">Sparse</option>
            <option value="balanced">Balanced</option>
            <option value="dense">Dense</option>
          </select>
          <button className="btn-quiet" onClick={onResetFilters}>Reset</button>
          <button className="btn-quiet" onClick={onDenseGraph}>Dense</button>
          <button className="btn-quiet" onClick={onAllNetwork}>All</button>
          <button className="btn-quiet" onClick={onCompareModes}>Compare</button>
          <button className="btn-quiet" onClick={onShareState}>Share</button>
          <button className="primary" onClick={onExportSubgraph}>Export CSV</button>
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

      <div className="analysis-layout">
        <section className="card graph-panel">
          <div className="card-head">
            <h3>Disease-Target-Drug Network</h3>
            <div className="muted">{graphMeta}</div>
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
              <button onClick={onFindPath}>Find Shortest Path</button>
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
              <button onClick={onRunDrugCompare}>Compare Drugs</button>
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
              <button className="primary" onClick={onLoadGraph}>Load Graph</button>
              <button onClick={onFitGraph}>Fit View</button>
              <button onClick={onExpandFromSelected}>Expand Selected</button>
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
              </div>
            ) : null}
          </div>
        </section>

        <aside className="side-column">
          <section className="card panel-pad rise-in">
            <h3>Selected Node</h3>
            <div key={`selected-${detailKey}`} className="card-swap">
              {detail?.node ? (
                <>
                  <div className="item-title">{detail.node.display_name || detail.node.label}</div>
                  <div className="item-meta">{detail.node.node_type} | {detail.node.id}</div>
                  {detail.node.node_type === "Drug" ? (
                    <div className="annot-box">
                      <div className="annot-title">SMILES</div>
                      <pre className="annot-text smiles-box">{smiles || "No SMILES available"}</pre>
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
                              Zoom
                            </button>
                            <a
                              className="structure-download-btn"
                              href={structureUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={`${detail.node.id || "drug"}_structure.png`}
                            >
                              Download PNG
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
                          "No UniProt available"
                        )}
                      </div>
                      {!uniprot ? <div className="annot-reason">{uniprotMissingReason}</div> : null}
                      {seq ? (
                        <>
                          <pre className="seq-box">{seq}</pre>
                          <div className="sequence-actions">
                            <button className="btn-quiet" type="button" onClick={copySequence}>
                              {sequenceCopied ? "Copied" : "Copy Sequence"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="item-meta">
                          {unresolvedHint || "Sequence not provided yet"}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="muted">Click node in graph or list</div>
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
              <div className="item-meta">Pisces-inspired evidence view for current node</div>
              <div className="quality-row">
                <span className={`quality-pill quality-${String(profile.quality_tier || "low").toLowerCase()}`}>{profile.quality_tier || "Low"} quality</span>
                <strong>{profile.quality_score ?? 0}</strong>
              </div>
              {(profile.missing_modalities || []).length ? (
                <div className="annot-reason">Missing modalities: {profile.missing_modalities.join(", ")}</div>
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
                )) : <div className="empty-state">No mechanism summary available.</div>}
              </div>
            </div>
            <div className="mechanism-section">
              <div className="annot-title">Evidence Sources</div>
              <div className="source-chip-wrap">
                {(mechanism.evidence_sources || []).length ? mechanism.evidence_sources.map((item) => (
                  <span className="source-chip" key={item.name}>{item.name} ({item.count})</span>
                )) : <div className="empty-state">No evidence source summary available.</div>}
              </div>
            </div>
            <div className="mechanism-section">
              <div className="annot-title">Context Summary</div>
              <div className="mechanism-links">
                {(mechanism.context_summary || []).length ? mechanism.context_summary.map((item) => (
                  <div className="mechanism-link-card" key={item}>
                    <div className="mechanism-link-meta">{item}</div>
                  </div>
                )) : <div className="empty-state">No context summary available.</div>}
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
                    <button className="primary" onClick={onLoadCompareSubgraph}>Load Compare Subgraph</button>
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
              <div className="empty-state">Enter two Drug IDs above to compare target overlap, disease overlap, and shared mechanism score.</div>
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
              )) : <div className="empty-state">No neighbors under current filter.</div>}
            </div>
            <div className="pager">
              <button onClick={() => onNeighborPage(-1)} disabled={neighborState.page <= 1}>Prev</button>
              <button
                onClick={() => onNeighborPage(1)}
                disabled={neighborState.page * neighborState.page_size >= neighborState.total}
              >
                Next
              </button>
            </div>
          </section>
        </aside>
      </div>
      {structureModalOpen && structureUrl ? (
        <div className="structure-modal-overlay" onClick={() => setStructureModalOpen(false)} role="presentation">
          <div className="structure-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="structure-modal-head">
              <div className="structure-modal-title">Chemical Structure</div>
              <button className="btn-quiet" type="button" onClick={() => setStructureModalOpen(false)}>Close</button>
            </div>
            <img className="structure-modal-img" src={structureUrl} alt="chemical structure large view" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
