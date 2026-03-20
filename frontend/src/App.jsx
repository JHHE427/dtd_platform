import React from "react";
import { api, query } from "./api";
import Header from "./components/Header";
import HomePage from "./components/HomePage";
import AnalysisPage from "./components/AnalysisPage";
import DatabasePage from "./components/DatabasePage";
import HelpPage from "./components/HelpPage";
import ErrorBoundary from "./components/ErrorBoundary";

function defaultNodesState() {
  return { total: 0, page: 1, page_size: 25, items: [] };
}

function getInitialAnalysisConfig() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const center = params.get("center");
  const depth = Number(params.get("depth"));
  const limit = Number(params.get("limit"));
  const categories = params.get("categories");
  const types = params.get("types");
  return {
    centerNode: center || "DB00157",
    graphMode: mode === "core" ? "core" : "full",
    depth: Number.isFinite(depth) && depth >= 1 && depth <= 2 ? depth : 2,
    limit: Number.isFinite(limit) && limit >= 50 && limit <= 2000 ? limit : 800,
    categories: categories ? categories.split(",").filter(Boolean) : ["Drug-Target", "Drug-Disease", "Target-Disease"],
    types: types ? types.split(",").filter(Boolean) : ["Known", "Predicted", "Known+Predicted"],
  };
}

export default function App() {
  const init = React.useMemo(() => getInitialAnalysisConfig(), []);
  const reqSeq = React.useRef({ graph: 0, detail: 0, neighbors: 0 });
  const graphReqKeyRef = React.useRef("");
  const [page, setPage] = React.useState("home");
  const [stats, setStats] = React.useState({ node_by_type: [], edge_by_type: [] });
  const [centerNode, setCenterNode] = React.useState(init.centerNode);
  const [graph, setGraph] = React.useState({ nodes: [], edges: [], depth: 2, center_id: "" });
  const [graphMeta, setGraphMeta] = React.useState("");
  const [detail, setDetail] = React.useState(null);
  const [hoverState, setHoverState] = React.useState(null);
  const [fitSignal, setFitSignal] = React.useState(0);
  const [graphLoading, setGraphLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [graphSearchText, setGraphSearchText] = React.useState("");
  const [densityMode, setDensityMode] = React.useState("balanced");
  const [pathState, setPathState] = React.useState({ source_id: "", target_id: "", max_hops: 4 });
  const [compareState, setCompareState] = React.useState({ left_id: init.centerNode, right_id: "", data: null });
  const [graphMode, setGraphMode] = React.useState(init.graphMode);
  const [graphControls, setGraphControls] = React.useState({
    depth: init.depth,
    limit: init.limit,
    categories: init.categories,
    types: init.types
  });

  const [nodeFilters, setNodeFilters] = React.useState({ q: "", node_type: "" });
  const [edgeFilters, setEdgeFilters] = React.useState({ q: "", edge_category: "", edge_type: "" });
  const [nodesState, setNodesState] = React.useState(defaultNodesState());
  const [edgesState, setEdgesState] = React.useState(defaultNodesState());
  const [selectedNodeId, setSelectedNodeId] = React.useState(init.centerNode);
  const [neighborState, setNeighborState] = React.useState({
    q: "",
    edge_category: "",
    edge_type: "",
    order_by: "weight_desc",
    page: 1,
    page_size: 25,
    total: 0,
    items: []
  });
  const [recentCenters, setRecentCenters] = React.useState(() => {
    try {
      const raw = localStorage.getItem("dtd_recent_centers");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, 8) : [];
    } catch {
      return [];
    }
  });

  const showToast = React.useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2200);
  }, []);

  const loadStats = React.useCallback(async () => {
    try {
      setStats(await api("/api/meta/stats"));
    } catch (e) {
      showToast("warn", `Load stats failed: ${e.message}`);
    }
  }, [showToast]);

  const loadGraph = React.useCallback(async (nodeId, overrideControls = null) => {
    const id = (nodeId || centerNode).trim();
    const wholeGraph = id === "__ALL__";
    if (!id && !wholeGraph) return;
    const mergedControls = overrideControls
      ? {
          ...graphControls,
          ...overrideControls,
          categories: overrideControls.categories || graphControls.categories,
          types: overrideControls.types || graphControls.types,
        }
      : graphControls;
    const reqKey = JSON.stringify({
      id,
      wholeGraph,
      mode: graphMode,
      depth: mergedControls.depth,
      limit: mergedControls.limit,
      categories: mergedControls.categories,
      types: mergedControls.types
    });
    if (graphReqKeyRef.current === reqKey && graphLoading) {
      return;
    }
    graphReqKeyRef.current = reqKey;

    const ticket = ++reqSeq.current.graph;
    setGraphLoading(true);
    try {
      const params = query({
        center_id: wholeGraph ? "" : id,
        mode: graphMode,
        whole_graph: wholeGraph ? "true" : "",
        depth: mergedControls.depth,
        limit: mergedControls.limit,
        edge_category: mergedControls.categories.join(","),
        edge_type: mergedControls.types.join(",")
      });
      let data = await api(`/api/graph?${params}`);
      let effectiveMode = graphMode;

      if (!wholeGraph && graphMode === "core" && (!data.edges?.length || (data.nodes?.length || 0) <= 1)) {
        const fullParams = query({
          center_id: id,
          mode: "full",
          depth: mergedControls.depth,
          limit: mergedControls.limit,
          edge_category: mergedControls.categories.join(","),
          edge_type: mergedControls.types.join(",")
        });
        const fallback = await api(`/api/graph?${fullParams}`);
        if (fallback.edges?.length) {
          data = fallback;
          effectiveMode = "full";
          setGraphMode("full");
          showToast("warn", "Current center has no visible edges in core mode, switched to full mode");
        }
      }

      if (ticket !== reqSeq.current.graph) return;
      setGraph(data);
      if (!wholeGraph) setCenterNode(id);
      setGraphMeta(`mode=${data.mode || effectiveMode} · center=${wholeGraph ? "ALL" : data.center_id} · depth=${data.depth} · nodes=${data.nodes.length} · edges=${data.edges.length}`);
    } catch (e) {
      showToast("warn", `Load graph failed: ${e.message}`);
    } finally {
      if (ticket === reqSeq.current.graph) setGraphLoading(false);
      if (graphReqKeyRef.current === reqKey) graphReqKeyRef.current = "";
    }
  }, [centerNode, graphControls, graphLoading, graphMode, showToast]);

  const loadDetail = React.useCallback(async (nodeId, options = { withNeighbors: false }) => {
    if (!nodeId) return;
    const ticket = ++reqSeq.current.detail;
    try {
      let endpoint = `/api/node/${encodeURIComponent(nodeId)}`;
      if (options.withNeighbors) {
        endpoint += `?${query({
          include_neighbors: "true",
          neighbor_page: neighborState.page,
          neighbor_page_size: neighborState.page_size,
          neighbor_q: neighborState.q,
          neighbor_edge_category: neighborState.edge_category,
          neighbor_edge_type: neighborState.edge_type,
          neighbor_order_by: neighborState.order_by,
        })}`;
      }
      const nodeData = await api(endpoint);
      if (ticket !== reqSeq.current.detail) return;
      setDetail(nodeData);
      setCenterNode(nodeId);
      setSelectedNodeId(nodeId);
      if (options.withNeighbors && nodeData.neighbors_page) {
        setNeighborState((prev) => ({
          ...prev,
          page: nodeData.neighbors_page.page,
          page_size: nodeData.neighbors_page.page_size,
          total: nodeData.neighbors_page.total,
          items: nodeData.neighbors_page.items || [],
        }));
      }
      setRecentCenters((prev) => {
        const next = [nodeId, ...prev.filter((x) => x !== nodeId)].slice(0, 8);
        try {
          localStorage.setItem("dtd_recent_centers", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } catch (e) {
      showToast("warn", `Load detail failed: ${e.message}`);
    }
  }, [neighborState.edge_category, neighborState.edge_type, neighborState.order_by, neighborState.page, neighborState.page_size, neighborState.q, showToast]);

  const loadNeighbors = React.useCallback(async (nodeId, overrides = {}) => {
    const targetId = nodeId || selectedNodeId;
    if (!targetId) return;
    const ticket = ++reqSeq.current.neighbors;
    const merged = { ...neighborState, ...overrides };
    const params = query({
      q: merged.q,
      edge_category: merged.edge_category,
      edge_type: merged.edge_type,
      order_by: merged.order_by,
      page: Math.max(1, merged.page),
      page_size: merged.page_size,
    });
    try {
      const data = await api(`/api/node/${encodeURIComponent(targetId)}/neighbors?${params}`);
      if (ticket !== reqSeq.current.neighbors) return;
      setNeighborState((prev) => ({
        ...prev,
        ...merged,
        page: data.page,
        page_size: data.page_size,
        total: data.total,
        items: data.items || [],
      }));
    } catch (e) {
      showToast("warn", `Load neighbors failed: ${e.message}`);
    }
  }, [neighborState, selectedNodeId, showToast]);

  const loadNodes = React.useCallback(async (nextPage = 1) => {
    try {
      const params = query({
        ...nodeFilters,
        page: Math.max(1, nextPage),
        page_size: nodesState.page_size
      });
      const data = await api(`/api/nodes?${params}`);
      setNodesState(data);
    } catch (e) {
      showToast("warn", `Load nodes failed: ${e.message}`);
    }
  }, [nodeFilters, nodesState.page_size, showToast]);

  const loadEdges = React.useCallback(async (nextPage = 1) => {
    try {
      const params = query({
        ...edgeFilters,
        page: Math.max(1, nextPage),
        page_size: edgesState.page_size
      });
      const data = await api(`/api/edges?${params}`);
      setEdgesState(data);
    } catch (e) {
      showToast("warn", `Load edges failed: ${e.message}`);
    }
  }, [edgeFilters, edgesState.page_size, showToast]);

  const searchAndAnalyze = React.useCallback(async (keyword) => {
    const q = (keyword || "").trim();
    if (!q) return;
    try {
      const r = await api(`/api/search?${query({ q, limit: 1 })}`);
      if (!r.items.length) {
        showToast("warn", `No match found for "${q}"`);
        return;
      }
      const node = r.items[0];
      setPage("analysis");
      await loadDetail(node.id, { withNeighbors: true });
      await loadGraph(node.id);
    } catch (e) {
      showToast("warn", `Search failed: ${e.message}`);
    }
  }, [loadDetail, loadGraph, showToast]);

  const suggestQuick = React.useCallback(async (keyword) => {
    if (!keyword?.trim()) return [];
    try {
      const r = await api(`/api/suggest?${query({ q: keyword, limit: 6 })}`);
      return r.items || [];
    } catch {
      return [];
    }
  }, []);

  const findPath = React.useCallback(async () => {
    const source = pathState.source_id.trim() || selectedNodeId || centerNode;
    const target = pathState.target_id.trim();
    if (!pathState.source_id.trim() && source) {
      setPathState((prev) => ({ ...prev, source_id: source }));
    }
    if (!source || !target) {
      showToast("warn", "Path source and target are required");
      return;
    }
    setGraphLoading(true);
    try {
      const data = await api(
        `/api/path?${query({
          source_id: source,
          target_id: target,
          mode: graphMode,
          max_hops: pathState.max_hops,
          edge_category: graphControls.categories.join(","),
          edge_type: graphControls.types.join(",")
        })}`
      );
      if (!data.found) {
        showToast("warn", `No path found within ${pathState.max_hops} hops`);
        return;
      }
      setGraph({
        center_id: source,
        depth: data.hops,
        nodes: data.nodes,
        edges: data.edges
      });
      setGraphMeta(`mode=${graphMode} · path ${source} → ${target} · hops=${data.hops} · nodes=${data.nodes.length} · edges=${data.edges.length}`);
      setCenterNode(source);
      await loadDetail(source, { withNeighbors: true });
      showToast("ok", `Path found with ${data.hops} hops`);
    } catch (e) {
      showToast("warn", `Path query failed: ${e.message}`);
    } finally {
      setGraphLoading(false);
    }
  }, [centerNode, graphControls, graphMode, loadDetail, pathState, selectedNodeId, showToast]);

  const downloadCsv = React.useCallback((filename, cols, rows) => {
    const escape = (x) => {
      const s = String(x ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [cols.join(",")];
    rows.forEach((row) => {
      lines.push(cols.map((c) => escape(row[c])).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportCurrentNodes = React.useCallback(async () => {
    try {
      const data = await api(`/api/nodes?${query({ ...nodeFilters, page: 1, page_size: 5000 })}`);
      downloadCsv(
        `dtd_nodes_${Date.now()}.csv`,
        ["id", "label", "node_type", "display_name", "source"],
        data.items || []
      );
      showToast("ok", `Exported ${data.items?.length || 0} nodes`);
    } catch (e) {
      showToast("warn", `Export nodes failed: ${e.message}`);
    }
  }, [downloadCsv, nodeFilters, showToast]);

  const exportCurrentEdges = React.useCallback(async () => {
    try {
      const data = await api(`/api/edges?${query({ ...edgeFilters, page: 1, page_size: 5000 })}`);
      downloadCsv(
        `dtd_edges_${Date.now()}.csv`,
        [
          "source",
          "source_label",
          "target",
          "target_label",
          "edge_category",
          "edge_type",
          "weight",
          "support_score",
          "remark"
        ],
        data.items || []
      );
      showToast("ok", `Exported ${data.items?.length || 0} edges`);
    } catch (e) {
      showToast("warn", `Export edges failed: ${e.message}`);
    }
  }, [downloadCsv, edgeFilters, showToast]);

  const exportSubgraph = React.useCallback(() => {
    if (!graph.edges?.length) return;
    const lines = ["source,target,edge_category,edge_type,weight,support_score,remark"];
    graph.edges.forEach((e) => {
      lines.push([e.source, e.target, e.edge_category, e.edge_type, e.weight, e.support_score ?? "", e.remark ?? ""].map((x) => {
        const s = String(x);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dtd_subgraph_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [graph]);

  const shareCurrentView = React.useCallback(async () => {
    const params = query({
      mode: graphMode,
      center: centerNode,
      depth: graphControls.depth,
      limit: graphControls.limit,
      categories: graphControls.categories.join(","),
      types: graphControls.types.join(","),
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("ok", "Share link copied");
    } catch {
      showToast("warn", "Copy failed");
    }
  }, [centerNode, graphControls, graphMode, showToast]);

  const compareModes = React.useCallback(async () => {
    const id = centerNode?.trim();
    if (!id) return;
    try {
      const base = {
        center_id: id,
        depth: graphControls.depth,
        limit: graphControls.limit,
        edge_category: graphControls.categories.join(","),
        edge_type: graphControls.types.join(","),
      };
      const core = await api(`/api/graph?${query({ ...base, mode: "core" })}`);
      const full = await api(`/api/graph?${query({ ...base, mode: "full" })}`);
      showToast("ok", `core ${core.edges.length} edges / full ${full.edges.length} edges`);
    } catch (e) {
      showToast("warn", `Compare failed: ${e.message}`);
    }
  }, [centerNode, graphControls, showToast]);

  const compareDrugs = React.useCallback(async () => {
    const left = compareState.left_id.trim();
    const right = compareState.right_id.trim();
    if (!left || !right) {
      showToast("warn", "Two drug IDs are required for comparison");
      return;
    }
    try {
      const data = await api(`/api/compare/drugs?${query({ left_id: left, right_id: right })}`);
      setCompareState((prev) => ({ ...prev, data }));
      showToast("ok", "Drug comparison updated");
    } catch (e) {
      showToast("warn", `Drug comparison failed: ${e.message}`);
    }
  }, [compareState.left_id, compareState.right_id, showToast]);

  const loadCompareSubgraph = React.useCallback(async () => {
    const left = compareState.left_id.trim();
    const right = compareState.right_id.trim();
    if (!left || !right) {
      showToast("warn", "Two drug IDs are required for comparison");
      return;
    }
    try {
      const data = await api(`/api/compare/drugs/subgraph?${query({ left_id: left, right_id: right })}`);
      setGraph({
        center_id: data.center_id,
        depth: data.depth,
        nodes: data.nodes || [],
        edges: data.edges || [],
      });
      if (data.comparison) {
        setCompareState((prev) => ({ ...prev, data: data.comparison }));
      }
      setCenterNode(left);
      setGraphMeta(`mode=compare · pair=${left} vs ${right} · nodes=${data.nodes?.length || 0} · edges=${data.edges?.length || 0}`);
      await loadDetail(left, { withNeighbors: true });
      setPage("analysis");
      showToast("ok", "Shared mechanism subgraph loaded");
    } catch (e) {
      showToast("warn", `Compare subgraph failed: ${e.message}`);
    }
  }, [compareState.left_id, compareState.right_id, loadDetail, showToast]);

  React.useEffect(() => {
    loadStats();
    loadNodes(1);
    loadEdges(1);
    loadGraph(centerNode);
    loadDetail(centerNode, { withNeighbors: true });
  }, [loadStats]); // intentionally single-run

  React.useEffect(() => {
    if (!centerNode) return;
    loadGraph(centerNode);
  }, [graphMode]); // reload same center when switching core/full mode

  React.useEffect(() => {
    if (!centerNode) return;
    const params = query({
      mode: graphMode,
      center: centerNode,
      depth: graphControls.depth,
      limit: graphControls.limit,
      categories: graphControls.categories.join(","),
      types: graphControls.types.join(","),
    });
    const url = `${window.location.pathname}?${params}`;
    window.history.replaceState({}, "", url);
  }, [centerNode, graphControls, graphMode]);

  return (
    <>
      <Header page={page} onPageChange={setPage} onQuickSearch={searchAndAnalyze} onSuggest={suggestQuick} />
      <main className="main-wrap">
        {page === "home" && <HomePage stats={stats} onAnalyze={searchAndAnalyze} />}
        {page === "analysis" && (
          <ErrorBoundary>
          <AnalysisPage
            graph={graph}
            centerNode={centerNode}
            graphMeta={graphMeta}
            detail={detail}
            neighborState={neighborState}
            recentCenters={recentCenters}
            graphMode={graphMode}
            graphSearchText={graphSearchText}
            pathState={pathState}
            onGraphSearchTextChange={setGraphSearchText}
            onCenterNodeChange={setCenterNode}
            onGraphModeChange={setGraphMode}
            onPathStateChange={(patch) => setPathState((prev) => ({ ...prev, ...patch }))}
            compareState={compareState}
            onCompareStateChange={(patch) => setCompareState((prev) => ({ ...prev, ...patch }))}
            onRunDrugCompare={compareDrugs}
            onLoadCompareSubgraph={loadCompareSubgraph}
            onCompareJump={async (id) => {
              setCenterNode(id);
              await loadDetail(id, { withNeighbors: true });
              await loadGraph(id);
              showToast("ok", `Loaded ${id} from comparison panel`);
            }}
            onLoadGraph={async () => {
              if (!centerNode?.trim()) {
                showToast("warn", "Center node is required");
                return;
              }
              if (!graphControls.categories.length || !graphControls.types.length) {
                showToast("warn", "Please keep at least one edge category/type selected");
                return;
              }
              await loadGraph(centerNode);
              showToast("ok", "Graph updated");
            }}
            onFindPath={findPath}
            onCompareModes={compareModes}
            onFitGraph={() => {
              if (!graph?.nodes?.length) {
                showToast("warn", "No graph to fit");
                return;
              }
              setFitSignal((v) => v + 1);
              showToast("ok", "View fitted");
            }}
            onShareState={shareCurrentView}
            onExpandFromSelected={async () => {
              const selected = detail?.node?.id || selectedNodeId || centerNode;
              if (!selected) {
                showToast("warn", "Select a node first");
                return;
              }
              const nextDepth = Math.min(2, graphControls.depth + 1);
              const nextLimit = graphControls.depth >= 2
                ? Math.min(2000, Math.round(graphControls.limit * 1.5))
                : graphControls.limit;
              const next = { ...graphControls, depth: nextDepth, limit: nextLimit };
              setGraphControls(next);
              await loadGraph(selected, next);
              showToast("ok", `Expanded from ${selected} (depth=${nextDepth}, limit=${nextLimit})`);
            }}
            onResetFilters={async () => {
              const next = {
                depth: 2,
                limit: 800,
                categories: ["Drug-Target", "Drug-Disease", "Target-Disease"],
                types: ["Known", "Predicted", "Known+Predicted"]
              };
              setGraphMode("full");
              setGraphControls(next);
              await loadGraph(centerNode, next);
              showToast("ok", "Filters reset");
            }}
            onDenseGraph={async () => {
              const next = {
                depth: 2,
                limit: 1200,
                categories: ["Drug-Target", "Drug-Disease", "Target-Disease"],
                types: ["Known", "Predicted", "Known+Predicted"]
              };
              setGraphMode("full");
              setGraphControls(next);
              await loadGraph(centerNode, next);
              showToast("ok", "Dense graph loaded");
            }}
            onAllNetwork={async () => {
              const next = {
                depth: 2,
                limit: 2500,
                categories: ["Drug-Target", "Drug-Disease", "Target-Disease"],
                types: ["Known", "Predicted", "Known+Predicted"]
              };
              setGraphMode("full");
              setGraphControls(next);
              await loadGraph("__ALL__", next);
              showToast("ok", "All-network view loaded (readable density)");
            }}
            onExportSubgraph={exportSubgraph}
            onNodeClick={async (id) => {
              await loadDetail(id, { withNeighbors: true });
              setCenterNode(id);
            }}
            onNodeDoubleClick={async (id) => {
              await loadDetail(id, { withNeighbors: true });
              const nextDepth = Math.min(2, graphControls.depth + 1);
              const nextLimit = graphControls.depth >= 2
                ? Math.min(2000, Math.round(graphControls.limit * 1.35))
                : graphControls.limit;
              const next = { ...graphControls, depth: nextDepth, limit: nextLimit };
              setGraphControls(next);
              await loadGraph(id, next);
              showToast("ok", `Expanded 1-hop from ${id}`);
            }}
            onRecentCenterClick={async (id) => {
              setCenterNode(id);
              await loadDetail(id, { withNeighbors: true });
              await loadGraph(id);
            }}
            onNeighborQueryChange={(patch) => setNeighborState((prev) => ({ ...prev, ...patch }))}
            onNeighborSearch={() => loadNeighbors(selectedNodeId, { page: 1 })}
            onNeighborPage={(delta) => loadNeighbors(selectedNodeId, { page: neighborState.page + delta })}
            hoverState={hoverState}
            onHoverNodeChange={setHoverState}
            fitSignal={fitSignal}
            graphLoading={graphLoading}
            controls={graphControls}
            onControlsChange={(patch) => setGraphControls((prev) => ({ ...prev, ...patch }))}
            densityMode={densityMode}
            onDensityModeChange={setDensityMode}
          />
          </ErrorBoundary>
        )}
        {page === "database" && (
          <DatabasePage
            nodesState={nodesState}
            edgesState={edgesState}
            nodeFilters={nodeFilters}
            edgeFilters={edgeFilters}
            onNodeFiltersChange={(patch) => setNodeFilters((prev) => ({ ...prev, ...patch }))}
            onEdgeFiltersChange={(patch) => setEdgeFilters((prev) => ({ ...prev, ...patch }))}
            onNodeSearch={() => loadNodes(1)}
            onEdgeSearch={() => loadEdges(1)}
            onNodePage={(delta) => loadNodes(nodesState.page + delta)}
            onEdgePage={(delta) => loadEdges(edgesState.page + delta)}
            onExportNodes={exportCurrentNodes}
            onExportEdges={exportCurrentEdges}
            canNodePrev={nodesState.page > 1}
            canNodeNext={nodesState.page * nodesState.page_size < nodesState.total}
            canEdgePrev={edgesState.page > 1}
            canEdgeNext={edgesState.page * edgesState.page_size < edgesState.total}
            onJumpToNode={async (id) => {
              setPage("analysis");
              await loadDetail(id, { withNeighbors: true });
              await loadGraph(id);
            }}
          />
        )}
        {page === "help" && <HelpPage />}
      </main>
      {toast ? <div className={`toast ${toast.type}`}>{toast.text}</div> : null}
    </>
  );
}
