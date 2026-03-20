import React from "react";

export default function DatabasePage({
  nodesState,
  edgesState,
  nodeFilters,
  edgeFilters,
  onNodeFiltersChange,
  onEdgeFiltersChange,
  onNodeSearch,
  onEdgeSearch,
  onNodePage,
  onEdgePage,
  onJumpToNode,
  onExportNodes,
  onExportEdges,
  canNodePrev,
  canNodeNext,
  canEdgePrev,
  canEdgeNext
}) {
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

  return (
    <section className="page is-active db-page">
      <div className="analysis-header page-head">
        <div>
          <h2>Database Browser</h2>
          <div className="analysis-subtitle">Structured access to nodes and relationships in the curated DTD network database</div>
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
                placeholder="Search drug / target / disease..."
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
              <button onClick={onNodeSearch}>Search Nodes</button>
            </div>
          </div>
          <div className="db-query-block">
            <div className="db-query-label">Edge Query</div>
            <div className="inline-filters edge db-filters db-filters-top">
              <input
                placeholder="Search source / target / remark..."
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
              <button onClick={onEdgeSearch}>Search Edges</button>
            </div>
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
              <h3>Node Browser</h3>
              <div className="db-panel-subtitle">Search and review drug, target, and disease records in the current network release.</div>
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
            )) : <div className="empty-state">No nodes matched current filters.</div>}
          </div>
          <div className="pager">
            <button onClick={() => onNodePage(-1)} disabled={!canNodePrev}>Prev</button>
            <span className="pager-status">Page {nodesState.page}</span>
            <button onClick={() => onNodePage(1)} disabled={!canNodeNext}>Next</button>
          </div>
        </section>

        <section className="card panel-pad db-panel">
          <div className="db-panel-head">
            <div>
              <h3>Edge Browser</h3>
              <div className="db-panel-subtitle">Review relationship category, evidence class, and support metrics in a unified list.</div>
            </div>
            <div className="muted">page {edgesState.page} · size {edgesState.page_size} · total {edgesState.total}</div>
          </div>
          <div className="list">
            {edgesState.items.length ? edgesState.items.map((e, idx) => (
              <div className="item db-item" key={`${e.source}-${e.target}-${e.edge_category}-${idx}`} onClick={() => onJumpToNode(e.source)}>
                <div className="db-item-top">
                  <div className="item-title">{e.source_label || e.source} → {e.target_label || e.target}</div>
                  <span className={`db-badge ${edgeTypeClass(e.edge_type)}`}>{e.edge_type}</span>
                </div>
                <div className="item-meta">
                  <span className="db-meta-pill">{e.edge_category}</span>
                  <span className="db-meta-pill">score {e.support_score ?? "NA"}</span>
                </div>
              </div>
            )) : <div className="empty-state">No edges matched current filters.</div>}
          </div>
          <div className="pager">
            <button onClick={() => onEdgePage(-1)} disabled={!canEdgePrev}>Prev</button>
            <span className="pager-status">Page {edgesState.page}</span>
            <button onClick={() => onEdgePage(1)} disabled={!canEdgeNext}>Next</button>
          </div>
        </section>
      </div>
    </section>
  );
}
