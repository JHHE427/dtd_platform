import React from "react";
import ForceGraph2D from "react-force-graph-2d";
import { forceCollide, forceX, forceY } from "d3-force";

function nodeColor(type) {
  if (type === "Disease") return "#ef4444";
  if (type === "Target") return "#f59e0b";
  if (type === "Drug") return "#3b82f6";
  if (type === "ncRNA") return "#14b8a6";
  return "#94a3b8";
}

function edgeColor(type) {
  if (type === "Known") return "#2563eb";
  if (type === "Predicted") return "#fb923c";
  if (type === "Known+Predicted") return "#8b5cf6";
  return "#94a3b8";
}

function linkNodeId(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x.id) return x.id;
  return "";
}

function hash01(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function hashSigned(text) {
  return hash01(text) * 2 - 1;
}

function typeHub(type) {
  if (type === "Drug") return { x: -280, y: -120 };
  if (type === "Target") return { x: 260, y: -130 };
  if (type === "ncRNA") return { x: -180, y: 220 };
  return { x: 40, y: 80 };
}

function modeHub(type, layoutMode) {
  if (layoutMode === "constellation") {
    if (type === "Drug") return { x: -620, y: -260 };
    if (type === "Target") return { x: 620, y: -260 };
    if (type === "ncRNA") return { x: -420, y: 420 };
    return { x: 140, y: 320 };
  }
  if (layoutMode === "clustered") {
    if (type === "Drug") return { x: -420, y: -160 };
    if (type === "Target") return { x: 420, y: -150 };
    if (type === "ncRNA") return { x: -260, y: 300 };
    return { x: 40, y: 140 };
  }
  if (type === "Drug") return { x: -360, y: -150 };
  if (type === "Target") return { x: 340, y: -140 };
  if (type === "ncRNA") return { x: -220, y: 250 };
  return { x: 50, y: 110 };
}

function initialNodePosition(node, centerId, layoutMode) {
  const seed = hash01(`${node.id}|${node.node_type}`);
  const signedA = hashSigned(`${node.id}|a`);
  const signedB = hashSigned(`${node.id}|b`);
  const signedC = hashSigned(`${node.id}|c`);
  const importance = Math.max(1, Number(node.importance) || 1);
  const hub = node.id === centerId ? { x: 0, y: 0 } : modeHub(node.node_type, layoutMode);
  const baseRadius =
    node.id === centerId
      ? 0
      : layoutMode === "constellation"
          ? node.node_type === "Disease"
            ? 170
            : node.node_type === "ncRNA"
              ? 260
              : 320
        : layoutMode === "clustered"
          ? node.node_type === "Disease"
            ? 190
            : node.node_type === "ncRNA"
              ? 280
              : 340
          : node.node_type === "Disease"
            ? 210
            : node.node_type === "ncRNA"
              ? 300
              : 360;
  const spread =
    node.id === centerId
      ? 0
      : layoutMode === "constellation"
        ? node.node_type === "Disease"
          ? 220
          : node.node_type === "ncRNA"
            ? 300
            : 380
        : layoutMode === "clustered"
          ? node.node_type === "Disease"
            ? 240
            : node.node_type === "ncRNA"
              ? 320
              : 400
          : node.node_type === "Disease"
            ? 260
            : node.node_type === "ncRNA"
              ? 340
              : 420;
  const importancePull = Math.max(0, 1 - Math.min(0.78, importance / 32));
  const radius = baseRadius + spread * seed * importancePull + spread * 0.16 * Math.abs(signedB);
  const angleBase =
    layoutMode === "constellation"
      ? node.node_type === "Drug"
        ? -Math.PI * 0.88
        : node.node_type === "Target"
          ? -Math.PI * 0.02
          : node.node_type === "ncRNA"
            ? Math.PI * 0.78
            : Math.PI * 0.26
      : node.node_type === "Drug"
        ? -Math.PI * 0.78
        : node.node_type === "Target"
          ? -Math.PI * 0.12
          : node.node_type === "ncRNA"
            ? Math.PI * 0.84
            : Math.PI * 0.18;
  const angleVariance = layoutMode === "constellation" ? 0.58 : layoutMode === "clustered" ? 0.76 : 0.95;
  const angle = angleBase + signedA * angleVariance + seed * Math.PI * (layoutMode === "constellation" ? 0.52 : 0.72);
  const orbit = radius * (0.84 + Math.abs(signedC) * 0.34);
  const driftX = signedB * (layoutMode === "constellation" ? 28 : 42 + spread * 0.08);
  const driftY = signedC * (layoutMode === "constellation" ? 24 : 34 + spread * 0.08);
  return {
    x: hub.x + Math.cos(angle) * orbit + driftX,
    y: hub.y + Math.sin(angle) * orbit + driftY
  };
}

function labelBudget(scale, densityMode) {
  const base =
    densityMode === "dense"
      ? { focus: 8, pinned: 12, important: 22, normal: 6 }
      : densityMode === "sparse"
        ? { focus: 12, pinned: 20, important: 44, normal: 18 }
        : { focus: 10, pinned: 16, important: 28, normal: 10 };
  if (scale >= 2.4) return { focus: 999, pinned: 72, important: 96, normal: 48 };
  if (scale >= 1.9) return { focus: 999, pinned: base.pinned + 8, important: base.important + 16, normal: base.normal + 10 };
  if (scale >= 1.4) return { focus: 999, pinned: base.pinned + 4, important: base.important + 6, normal: base.normal + 4 };
  return { focus: 999, pinned: base.pinned, important: base.important, normal: base.normal };
}

function labelAnchors(node, radius) {
  const seed = hash01(node.id || node.label || "");
  const bias =
    node.node_type === "Drug"
      ? ["right", "top-right", "bottom-right", "top", "bottom"]
      : node.node_type === "Target"
        ? ["top-right", "right", "top", "bottom-right", "bottom"]
        : node.node_type === "ncRNA"
          ? ["bottom-left", "left", "bottom", "top-left", "top"]
        : ["left", "top-left", "bottom-left", "top", "bottom"];
  const rotate = Math.floor(seed * bias.length);
  const ordered = [...bias.slice(rotate), ...bias.slice(0, rotate)];
  return ordered.map((slot) => {
    const pad = radius + 5;
    if (slot === "right") return { dx: pad, dy: 0, align: "left" };
    if (slot === "left") return { dx: -pad, dy: 0, align: "right" };
    if (slot === "top") return { dx: 0, dy: -(pad + 3), align: "center" };
    if (slot === "bottom") return { dx: 0, dy: pad + 3, align: "center" };
    if (slot === "top-right") return { dx: pad, dy: -(pad * 0.55), align: "left" };
    if (slot === "bottom-right") return { dx: pad, dy: pad * 0.55, align: "left" };
    if (slot === "top-left") return { dx: -pad, dy: -(pad * 0.55), align: "right" };
    if (slot === "bottom-left") return { dx: -pad, dy: pad * 0.55, align: "right" };
    return { dx: pad, dy: 0, align: "left" };
  });
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function fadeBetween(scale, start, end) {
  if (scale <= start) return 0;
  if (scale >= end) return 1;
  return clamp01((scale - start) / Math.max(0.001, end - start));
}

function mixColor(hex, amount = 0.3) {
  const normalized = (hex || "#94a3b8").replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function rgbaFromHex(hex, alpha) {
  const normalized = (hex || "#94a3b8").replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorChannels(hex) {
  const normalized = (hex || "#94a3b8").replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

export default function GraphCanvas({
  graph,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  centerId,
  searchText,
  fitSignal,
  densityMode = "balanced",
  layoutMode = "organic"
}) {
  const fgRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const clickRef = React.useRef({ id: "", ts: 0 });
  const mouseRef = React.useRef({ x: 0, y: 0 });
  const zoomRef = React.useRef(1);
  const labelLayoutRef = React.useRef({ frameBucket: -1, boxes: [], counts: { focus: 0, pinned: 0, important: 0, normal: 0 } });
  const [size, setSize] = React.useState({ w: 1000, h: 620 });
  const [hoverId, setHoverId] = React.useState("");
  const [selectedId, setSelectedId] = React.useState("");

  React.useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = () => setSize({ w: Math.max(480, el.clientWidth), h: Math.max(320, el.clientHeight) });
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const graphData = React.useMemo(() => {
    const allNodes = (graph?.nodes || []).map((n) => ({ ...n }));
    const allLinks = (graph?.edges || []).map((e, idx) => ({ ...e, id: `${idx}-${e.source}-${e.target}` }));
    const deg = new Map(allNodes.map((n) => [n.id, 0]));
    allLinks.forEach((l) => {
      deg.set(l.source, (deg.get(l.source) || 0) + 1);
      deg.set(l.target, (deg.get(l.target) || 0) + 1);
    });
    allNodes.forEach((n) => {
      n.degree = deg.get(n.id) || 0;
      n.importance = (n.degree || 0) + (n.id === centerId ? 8 : 1);
    });

    let keepNodeIds = new Set(allNodes.map((n) => n.id));
    let keepLinks = allLinks;

    const densityCfg = {
      sparse: { triggerEdges: 420, triggerNodes: 300, topNodes: 180, topEdges: 300 },
      balanced: { triggerEdges: 760, triggerNodes: 520, topNodes: 300, topEdges: 520 },
      dense: { triggerEdges: 1280, triggerNodes: 760, topNodes: 520, topEdges: 880 }
    }[densityMode] || { triggerEdges: 760, triggerNodes: 520, topNodes: 300, topEdges: 520 };

    // For very dense graphs, render a readable high-information subgraph.
    if (allLinks.length > densityCfg.triggerEdges || allNodes.length > densityCfg.triggerNodes) {
      const sortedNodes = [...allNodes].sort((a, b) => (b.importance || 0) - (a.importance || 0));
      const topNodes = sortedNodes.slice(0, densityCfg.topNodes);
      keepNodeIds = new Set(topNodes.map((n) => n.id));
      if (centerId) keepNodeIds.add(centerId);
      keepLinks = allLinks
        .filter((l) => keepNodeIds.has(l.source) && keepNodeIds.has(l.target))
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, densityCfg.topEdges);
      const nodeIdsFromLinks = new Set();
      keepLinks.forEach((l) => {
        nodeIdsFromLinks.add(l.source);
        nodeIdsFromLinks.add(l.target);
      });
      if (centerId) nodeIdsFromLinks.add(centerId);
      keepNodeIds = nodeIdsFromLinks;
    }

    const nodes = allNodes
      .filter((n) => keepNodeIds.has(n.id))
      .sort((a, b) => {
        const pri = (b.id === centerId) - (a.id === centerId);
        if (pri) return pri;
        return (b.importance || 0) - (a.importance || 0);
      })
      .map((n) => {
        const pos = initialNodePosition(n, centerId, layoutMode);
        return {
          ...n,
          x: Number.isFinite(n.x) ? n.x : pos.x,
          y: Number.isFinite(n.y) ? n.y : pos.y,
          vx: 0,
          vy: 0
        };
      });
    const links = keepLinks.map((l) => {
      const s = linkNodeId(l.source);
      const t = linkNodeId(l.target);
      const curveSeed = hash01(`${s}->${t}`);
      const categoryBoost =
        l.edge_category === "Drug-Disease"
          ? 1.65
          : l.edge_category === "Target-Disease"
            ? 1.52
            : l.edge_category === "ncRNA-Drug"
              ? 1.46
              : l.edge_category === "ncRNA-Disease"
                ? 1.58
                : l.edge_category === "ncRNA-Target"
                  ? 1.42
              : 1.16;
      const curve = (curveSeed - 0.5) * 0.62 * categoryBoost;
      const supportScore = Number.isFinite(Number(l.support_score)) ? Number(l.support_score) : 0;
      const weight = Number.isFinite(Number(l.weight)) ? Number(l.weight) : 0;
      const predictedSupportTier =
        l.edge_type === "Predicted"
          ? supportScore >= 0.85 || weight >= 2.2
            ? "high"
            : supportScore >= 0.6 || weight >= 1.5
              ? "medium"
              : "base"
          : "base";
      return { ...l, source: s, target: t, curve, supportScore, predictedSupportTier };
    });
    return { nodes, links };
  }, [graph, centerId, densityMode, layoutMode]);

  const neighborMap = React.useMemo(() => {
    const m = new Map();
    graphData.nodes.forEach((n) => m.set(n.id, new Set([n.id])));
    graphData.links.forEach((l) => {
      const s = linkNodeId(l.source);
      const t = linkNodeId(l.target);
      if (!m.has(s)) m.set(s, new Set([s]));
      if (!m.has(t)) m.set(t, new Set([t]));
      m.get(s).add(t);
      m.get(t).add(s);
    });
    return m;
  }, [graphData]);
  const nodeById = React.useMemo(() => new Map(graphData.nodes.map((n) => [n.id, n])), [graphData.nodes]);
  const performanceMode = graphData.nodes.length > 120 || graphData.links.length > 220;
  const ultraDenseMode = graphData.nodes.length > 240 || graphData.links.length > 420;

  const focusId = hoverId || selectedId;
  const focusNeighbors = React.useMemo(() => (focusId ? neighborMap.get(focusId) || new Set([focusId]) : null), [focusId, neighborMap]);
  const nodeEvidence = React.useMemo(() => {
    const map = new Map();
    const addType = (nid, tp) => {
      if (!map.has(nid)) map.set(nid, { Known: 0, Predicted: 0, "Known+Predicted": 0 });
      if (tp === "Known" || tp === "Predicted" || tp === "Known+Predicted") map.get(nid)[tp] += 1;
    };
    graphData.links.forEach((l) => {
      const s = linkNodeId(l.source);
      const t = linkNodeId(l.target);
      addType(s, l.edge_type);
      addType(t, l.edge_type);
    });
    return map;
  }, [graphData]);

  React.useEffect(() => {
    if (!fgRef.current) return;
    const densityForces = {
      sparse: { charge: -150, collision: 0.92, xStrength: 0.015, yStrength: 0.015 },
      balanced: { charge: -210, collision: 1.04, xStrength: 0.019, yStrength: 0.019 },
      dense: { charge: -250, collision: 1.1, xStrength: 0.022, yStrength: 0.022 }
    }[densityMode] || { charge: -210, collision: 1.04, xStrength: 0.019, yStrength: 0.019 };
    const layoutForces = {
      organic: { center: 0.014, drift: 0.82, collision: 0.86, radial: 0.92, fitMs: 240, settleMs: 260 },
      clustered: { center: 0.012, drift: 0.94, collision: 0.92, radial: 0.8, fitMs: 270, settleMs: 300 },
      constellation: { center: 0.009, drift: 1.04, collision: 0.98, radial: 0.68, fitMs: 300, settleMs: 340 }
    }[layoutMode] || { center: 0.014, drift: 0.88, collision: 0.9, radial: 0.96, fitMs: 260, settleMs: 300 };
    fgRef.current.d3Force("link").distance((l) => {
      const base =
        l.edge_category === "Drug-Target"
          ? (l.edge_type === "Known+Predicted" ? 62 : 88)
          : (l.edge_category === "Drug-Disease" || l.edge_category === "Target-Disease" || l.edge_category === "ncRNA-Disease")
            ? 120
            : (l.edge_category === "ncRNA-Drug" || l.edge_category === "ncRNA-Target")
              ? 112
              : 96;
      return base * layoutForces.radial;
    });
    fgRef.current.d3Force("charge").strength((node) => {
      const base = densityForces.charge;
      const importance = Math.max(1, Number(node.importance) || 1);
      const typeBoost = node.node_type === "Disease" ? 1.08 : node.node_type === "ncRNA" ? 1.06 : 1;
      return base * layoutForces.drift * typeBoost * (0.88 + Math.min(0.6, Math.sqrt(importance) * 0.08));
    });
    fgRef.current.d3Force("center").strength(layoutForces.center);
    fgRef.current.d3Force(
      "collision",
      forceCollide((node) => {
        const importance = Math.max(1, Number(node.importance) || 1);
        return 6 + Math.sqrt(importance) * densityForces.collision * layoutForces.collision + (node.node_type === "Disease" ? 3.4 : 1.8);
      }).iterations(ultraDenseMode ? 1 : performanceMode ? 1 : 2)
    );
    fgRef.current.d3Force(
      "type-x",
      forceX((node) => (node.id === centerId ? 0 : modeHub(node.node_type, layoutMode).x)).strength((node) => {
        if (node.id === centerId) return 0.09;
        return densityForces.xStrength * layoutForces.drift * (node.node_type === "Disease" ? 1.12 : 1);
      })
    );
    fgRef.current.d3Force(
      "type-y",
      forceY((node) => (node.id === centerId ? 0 : modeHub(node.node_type, layoutMode).y)).strength((node) => {
        if (node.id === centerId) return 0.09;
        return densityForces.yStrength * layoutForces.drift * (node.node_type === "Disease" ? 1.12 : 1);
      })
    );
    fgRef.current.d3ReheatSimulation();
    const t = setTimeout(() => {
      if (!fgRef.current) return;
      fgRef.current.zoomToFit(layoutForces.fitMs, 6);
      const currentZoom = typeof fgRef.current.zoom === "function" ? fgRef.current.zoom() : 1;
      if (typeof fgRef.current.zoom === "function") {
        fgRef.current.zoom(currentZoom * 1.24, Math.max(110, layoutForces.fitMs - 90));
      }
      fgRef.current.cooldownTicks(0);
    }, layoutForces.settleMs);
    const t2 = setTimeout(() => {
      if (!fgRef.current) return;
      fgRef.current.zoomToFit(Math.max(160, layoutForces.fitMs - 70), 3);
      const currentZoom = typeof fgRef.current.zoom === "function" ? fgRef.current.zoom() : 1;
      if (typeof fgRef.current.zoom === "function") {
        fgRef.current.zoom(currentZoom * 1.18, 110);
      }
    }, layoutForces.settleMs + 180);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [graphData, centerId, densityMode, layoutMode]);

  React.useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.zoomToFit(180, 4);
    const currentZoom = typeof fgRef.current.zoom === "function" ? fgRef.current.zoom() : 1;
    if (typeof fgRef.current.zoom === "function") {
      fgRef.current.zoom(currentZoom * 1.16, 110);
    }
  }, [fitSignal]);

  const needle = (searchText || "").trim().toLowerCase();
  const sampled = (graph?.edges?.length || 0) > (graphData?.links?.length || 0);

  return (
    <div
      ref={shellRef}
      className="graph-canvas-shell"
      onMouseMove={(e) => {
        const r = shellRef.current?.getBoundingClientRect();
        if (!r) return;
        mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={3.4}
        warmupTicks={2}
        cooldownTime={260}
        cooldownTicks={18}
        d3AlphaDecay={0.16}
        d3VelocityDecay={0.56}
        onZoom={({ k }) => { zoomRef.current = k; }}
        linkCurvature={(l) => (ultraDenseMode ? 0 : (l.curve || 0))}
        linkDirectionalArrowLength={0}
        nodeVal={(n) => Math.max(3, 2 + Math.sqrt(n.importance || 1) * 1.8)}
        nodeCanvasObject={(node, ctx, scale) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const frameBucket = Math.floor(performance.now() / 14);
          if (labelLayoutRef.current.frameBucket !== frameBucket) {
            labelLayoutRef.current = { frameBucket, boxes: [], counts: { focus: 0, pinned: 0, important: 0, normal: 0 } };
          }
          const isHover = node.id === hoverId;
          const isSelected = node.id === selectedId;
          const isHit = needle ? `${node.display_name || node.label} ${node.id}`.toLowerCase().includes(needle) : false;
          const inFocus = !focusNeighbors || focusNeighbors.has(node.id);
          const focusRole = !focusId ? "ambient" : node.id === focusId ? "self" : inFocus ? "neighbor" : "ambient";
          const typeBoost = node.node_type === "Disease" ? 1.08 : node.node_type === "ncRNA" ? 1.05 : 1;
          const centerBoost = node.id === centerId ? 1.18 : 1;
          const focusScale = focusRole === "self" ? 1.08 : focusRole === "neighbor" ? 1 : focusId ? 0.84 : 1;
          const r = Math.max(3, (2 + Math.sqrt(node.importance || 1) * 1.8) * typeBoost * centerBoost * focusScale);
          const ev = nodeEvidence.get(node.id) || { Known: 0, Predicted: 0, "Known+Predicted": 0 };
          const evTotal = ev.Known + ev.Predicted + ev["Known+Predicted"];
          const baseNodeColor = nodeColor(node.node_type);
          const softNodeColor = mixColor(baseNodeColor, 0.48);
          const { r: cr, g: cg, b: cb } = colorChannels(baseNodeColor);
          const haloAlpha = isHover || isSelected || node.id === centerId ? 0.3 : (node.importance || 0) >= 10 ? 0.14 : 0.08;
          const pedestalAlpha = isHover || isSelected ? 0.18 : node.id === centerId ? 0.13 : 0.08;
          const rimAlpha = isHover || isSelected ? 0.34 : node.id === centerId ? 0.28 : 0.18;
          const innerGlowAlpha = isHover || isSelected ? 0.24 : 0.12;
          const simplifiedNode =
            performanceMode &&
            !isHover &&
            !isSelected &&
            node.id !== centerId &&
            !isHit &&
            (!focusId || focusRole === "ambient");

          ctx.save();
          ctx.globalAlpha = focusRole === "self" ? 1 : focusRole === "neighbor" ? 0.94 : focusId ? 0.14 : 1;
          if (simplifiedNode) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(2.4, r * 0.92), 0, 2 * Math.PI);
            ctx.fillStyle = baseNodeColor;
            ctx.fill();
            if (node.node_type === "Disease") {
              ctx.beginPath();
              ctx.arc(node.x, node.y, Math.max(3.2, r + 1.4), 0, 2 * Math.PI);
              ctx.strokeStyle = "rgba(255,255,255,0.28)";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            ctx.restore();
            return;
          }
          ctx.beginPath();
          ctx.ellipse(node.x, node.y + r * 1.02, r * 1.75, Math.max(2.4, r * 0.62), 0, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(15, 23, 42, ${pedestalAlpha})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 10.2, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${haloAlpha * 0.72})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6.8, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${haloAlpha})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 3.4, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${rimAlpha})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          if (node.node_type === "Disease") {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4.8, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(239, 68, 68, 0.18)";
            ctx.lineWidth = 2.1;
            ctx.stroke();
          }
          if (node.node_type === "ncRNA") {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4.6, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(20, 184, 166, 0.22)";
            ctx.lineWidth = 2.1;
            ctx.stroke();
          }
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 7.5, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(37,99,235,0.12)";
            ctx.fill();
          }
          if (node.id === centerId) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 9.6, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(37, 99, 235, 0.3)";
            ctx.lineWidth = 2.3;
            ctx.stroke();
          }

          const useShadow = isHover || isSelected || node.id === centerId;
          if (useShadow) {
            ctx.shadowColor = isHover || isSelected
              ? "rgba(15,23,42,0.34)"
              : rgbaFromHex(baseNodeColor, 0.28);
            ctx.shadowBlur = isHover || isSelected ? 14 : 11;
            ctx.shadowOffsetY = 2;
          }
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          if (performanceMode && !isHover && !isSelected && node.id !== centerId) {
            ctx.fillStyle = baseNodeColor;
          } else {
            const gradient = ctx.createRadialGradient(node.x - r * 0.32, node.y - r * 0.34, Math.max(0.5, r * 0.18), node.x, node.y, r);
            gradient.addColorStop(0, mixColor(baseNodeColor, 0.82));
            gradient.addColorStop(0.22, mixColor(baseNodeColor, 0.62));
            gradient.addColorStop(0.5, softNodeColor);
            gradient.addColorStop(0.82, baseNodeColor);
            gradient.addColorStop(1, rgbaFromHex(baseNodeColor, 0.98));
            ctx.fillStyle = gradient;
          }
          ctx.fill();
          if (!performanceMode || isHover || isSelected || node.id === centerId) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(1.6, r * 0.72), 0, 2 * Math.PI);
            const innerGradient = ctx.createRadialGradient(
              node.x - r * 0.14,
              node.y - r * 0.18,
              Math.max(0.4, r * 0.08),
              node.x,
              node.y,
              Math.max(1.6, r * 0.72)
            );
            innerGradient.addColorStop(0, `rgba(255,255,255,${0.34 + innerGlowAlpha})`);
            innerGradient.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = innerGradient;
            ctx.fill();
          }
          if (!performanceMode || isHover || isSelected || node.id === centerId) {
            ctx.beginPath();
            ctx.arc(node.x - r * 0.26, node.y - r * 0.32, Math.max(1.6, r * 0.34), 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(node.x + r * 0.18, node.y + r * 0.2, Math.max(1.4, r * 0.34), Math.max(1.1, r * 0.18), Math.PI / 6, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.fill();
          }
          ctx.lineWidth = isHover || isSelected || isHit ? 2 : 1.2;
          ctx.strokeStyle = isHover || isSelected || isHit ? "#111827" : "#ffffff";
          ctx.stroke();
          if (!performanceMode || isHover || isSelected || node.id === centerId) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(1.2, r - 1.7), 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(255,255,255,${node.id === centerId ? 0.42 : 0.18})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
          if (useShadow) {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
          }
          if (evTotal > 0 && (!performanceMode || isHover || isSelected || node.id === centerId)) {
            let start = -Math.PI / 2;
            const drawArc = (count, color) => {
              if (!count) return;
              const angle = (count / evTotal) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + 2.8, start, start + angle);
              ctx.strokeStyle = color;
              ctx.lineWidth = Math.max(1.4, 2 / Math.sqrt(scale));
              ctx.stroke();
              start += angle;
            };
            drawArc(ev.Known, "#2563eb");
            drawArc(ev.Predicted, "#fb923c");
            drawArc(ev["Known+Predicted"], "#8b5cf6");
          }
          const zoomShowAll = scale >= 2.1;
            const zoomShowPinned = scale >= 1.05 && (node.importance || 0) >= 16;
            const zoomShowImportant = scale >= 1.3 && (node.importance || 0) >= 10;
            const zoomShowMedium = scale >= 1.6 && (node.importance || 0) >= 6;
            const zoomShowWide = scale >= 2.05 && (node.importance || 0) >= 3;
          const shouldShowLabel =
            isHover ||
            isSelected ||
            node.id === centerId ||
            isHit ||
            zoomShowPinned ||
            zoomShowAll ||
            zoomShowImportant ||
            zoomShowMedium ||
            zoomShowWide;
          if (shouldShowLabel) {
            const text = node.display_name || node.label || node.id;
            const pinned = zoomShowPinned && !isHover && !isSelected && node.id !== centerId && !isHit;
            const labelTier = isHover || isSelected || node.id === centerId || isHit ? "focus" : pinned ? "pinned" : (node.importance || 0) >= 8 ? "important" : "normal";
            const priority = isHover || isSelected || node.id === centerId || isHit || pinned;
            const budget = labelBudget(scale, densityMode);
            const counts = labelLayoutRef.current.counts || { focus: 0, pinned: 0, important: 0, normal: 0 };
            if ((focusId && focusRole === "ambient" && !priority) || (!priority && (counts[labelTier] || 0) >= (budget[labelTier] || 0))) {
              ctx.restore();
              return;
            }
            const tierFade =
              labelTier === "focus"
                ? 1
                : labelTier === "pinned"
                  ? fadeBetween(scale, 0.9, 1.2)
                  : labelTier === "important"
                    ? fadeBetween(scale, 1.05, 1.55)
                    : zoomShowAll
                      ? 1
                      : fadeBetween(scale, 1.45, 2.15);
            const fsBase = labelTier === "focus" ? 12.6 : labelTier === "pinned" ? 12 : labelTier === "important" ? 11.2 : 10.6;
            const fs = Math.max(8.5, fsBase / Math.max(scale, 0.8));
            const fontWeight = labelTier === "normal" ? 600 : 700;
            const badgeRadius = labelTier === "focus" ? 4.4 : labelTier === "pinned" ? 3.8 : labelTier === "important" ? 3.4 : 0;
            ctx.font = `${fontWeight} ${fs}px "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif`;
            ctx.textBaseline = "middle";
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width + (badgeRadius ? badgeRadius * 2 + 6 : 0);
            const padX = 5;
            const padY = 3;
            const anchors = priority ? [{ dx: r + 6, dy: 0, align: "left" }, ...labelAnchors(node, r)] : labelAnchors(node, r);
            let placement = null;
            for (const anchor of anchors) {
              const textX =
                anchor.align === "center" ? node.x + anchor.dx - textWidth / 2 : anchor.align === "right" ? node.x + anchor.dx - textWidth : node.x + anchor.dx;
              const box = {
                x1: textX - padX,
                y1: node.y + anchor.dy - fs / 2 - padY,
                x2: textX + textWidth + padX,
                y2: node.y + anchor.dy + fs / 2 + padY,
                align: anchor.align
              };
              const overlaps = labelLayoutRef.current.boxes.some(
                (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)
              );
              if (!overlaps || priority) {
                placement = { box, textX, textY: node.y + anchor.dy, align: anchor.align };
                break;
              }
            }
            if (placement) {
              labelLayoutRef.current.boxes.push(placement.box);
              labelLayoutRef.current.counts[labelTier] = (labelLayoutRef.current.counts[labelTier] || 0) + 1;
              const textStartX = placement.textX + (badgeRadius ? badgeRadius * 2 + 6 : 0);
              const needsGuide = Math.abs(placement.textY - node.y) > 1 || Math.abs(placement.textX - (node.x + r + 6)) > 6;
              ctx.globalAlpha *= 0.48 + tierFade * 0.52;
              if (needsGuide) {
                const guideTargetX =
                  placement.align === "right" ? placement.box.x2 : placement.align === "center" ? (placement.box.x1 + placement.box.x2) / 2 : placement.box.x1;
                const guideStartX = node.x + ((guideTargetX >= node.x) ? r * 0.78 : -r * 0.78);
                const guideStartY = node.y + (placement.textY - node.y) * 0.18;
                ctx.beginPath();
                ctx.moveTo(guideStartX, guideStartY);
                ctx.lineTo(guideTargetX, placement.textY);
                ctx.strokeStyle = inFocus ? "rgba(148,163,184,0.72)" : "rgba(148,163,184,0.38)";
                ctx.lineWidth = 0.85;
                ctx.stroke();
              }
              ctx.fillStyle = inFocus ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.66)";
              ctx.strokeStyle = inFocus ? "rgba(203,213,225,0.98)" : "rgba(226,232,240,0.62)";
              ctx.lineWidth = 1;
              const radius = 6;
              const box = placement.box;
              ctx.beginPath();
              ctx.moveTo(box.x1 + radius, box.y1);
              ctx.lineTo(box.x2 - radius, box.y1);
              ctx.quadraticCurveTo(box.x2, box.y1, box.x2, box.y1 + radius);
              ctx.lineTo(box.x2, box.y2 - radius);
              ctx.quadraticCurveTo(box.x2, box.y2, box.x2 - radius, box.y2);
              ctx.lineTo(box.x1 + radius, box.y2);
              ctx.quadraticCurveTo(box.x1, box.y2, box.x1, box.y2 - radius);
              ctx.lineTo(box.x1, box.y1 + radius);
              ctx.quadraticCurveTo(box.x1, box.y1, box.x1 + radius, box.y1);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              if (badgeRadius) {
                ctx.beginPath();
                ctx.arc(placement.box.x1 + 9, placement.textY, badgeRadius, 0, 2 * Math.PI);
                ctx.fillStyle =
                  labelTier === "focus"
                    ? "#2563eb"
                    : labelTier === "pinned"
                      ? "#7c3aed"
                      : "rgba(59,130,246,0.78)";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(placement.box.x1 + 9, placement.textY, Math.max(1.6, badgeRadius - 1.8), 0, 2 * Math.PI);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
              }
              ctx.fillStyle = inFocus ? "#0f172a" : "rgba(51,65,85,0.76)";
              ctx.textAlign = "left";
              ctx.fillText(text, textStartX, placement.textY);
            }
          }
          ctx.restore();
        }}
        linkColor={() => "rgba(0,0,0,0)"}
        linkWidth={0.0001}
        linkCanvasObject={(l, ctx) => {
          const s = typeof l.source === "object" ? l.source : nodeById.get(l.source);
          const t = typeof l.target === "object" ? l.target : nodeById.get(l.target);
          if (!s || !t || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(t.x) || !Number.isFinite(t.y)) return;
          const inFocus = !focusNeighbors || (focusNeighbors.has(s.id) && focusNeighbors.has(t.id));
          const directlyTouchesFocus = !!focusId && (s.id === focusId || t.id === focusId);
          const neighborBand = !!focusId && !directlyTouchesFocus && inFocus;
          const categoryBoost =
            l.edge_category === "Drug-Target"
              ? 1.02
              : l.edge_category === "Drug-Disease" || l.edge_category === "Target-Disease"
                ? 1.14
                : l.edge_category === "ncRNA-Disease"
                  ? 1.18
                  : l.edge_category === "ncRNA-Target"
                    ? 1.08
                    : 1.1;
          const curZoom = zoomRef.current;
          const zoomAlpha = 0.62 + fadeBetween(curZoom, 0.95, 1.85) * 0.34;
          const supportBoost = l.predictedSupportTier === "high" ? 1.18 : l.predictedSupportTier === "medium" ? 1.08 : 1;
          const alphaBase = directlyTouchesFocus ? 0.94 : neighborBand ? 0.58 : inFocus ? 0.38 : focusId ? 0.035 : 0.18;
          const alpha = alphaBase * zoomAlpha * supportBoost * categoryBoost;
          const zoomWidthBoost = fadeBetween(curZoom, 1.05, 2.1) * 0.42;
          const widthBase = directlyTouchesFocus ? 1.1 : neighborBand ? 0.92 : inFocus ? 0.8 : 0.58;
          const lw = (Math.min(0.75 + (l.weight || 1) * 0.42 + zoomWidthBoost, 2.8) * supportBoost + (inFocus ? 0.12 : 0)) * widthBase * categoryBoost;
          const color = edgeColor(l.edge_type);
          const categoryTint =
            l.edge_category === "ncRNA-Disease"
              ? "#14b8a6"
              : l.edge_category === "Drug-Disease" || l.edge_category === "Target-Disease"
                ? "#ef4444"
                : l.edge_category === "ncRNA-Target"
                  ? "#0ea5a4"
                  : l.edge_category === "ncRNA-Drug"
                    ? "#14b8a6"
                    : color;
          const glowColor = rgbaFromHex(categoryTint, directlyTouchesFocus ? 0.26 : neighborBand ? 0.14 : inFocus ? 0.1 : 0.04);
          const sheenColor = rgbaFromHex(mixColor(color, 0.68), directlyTouchesFocus ? 0.3 : inFocus ? 0.16 : 0.05);
          const cx = (s.x + t.x) / 2 + (t.y - s.y) * (l.curve || 0);
          const cy = (s.y + t.y) / 2 + (s.x - t.x) * (l.curve || 0);
          const simplifiedLink = performanceMode && !directlyTouchesFocus && !neighborBand;
          ctx.save();
          ctx.globalAlpha = alpha;
          if (simplifiedLink) {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            if (ultraDenseMode) {
              ctx.lineTo(t.x, t.y);
            } else {
              ctx.quadraticCurveTo(cx, cy, t.x, t.y);
            }
            ctx.strokeStyle = rgbaFromHex(categoryTint, inFocus ? 0.1 : 0.035);
            ctx.lineWidth = Math.max(0.3, lw * 0.72);
            if (l.edge_type === "Predicted") ctx.setLineDash([3, 3]);
            if (l.edge_type === "Known+Predicted") ctx.setLineDash([6, 3]);
            ctx.stroke();
            ctx.restore();
            return;
          }
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(cx, cy, t.x, t.y);
          ctx.strokeStyle = rgbaFromHex(categoryTint, directlyTouchesFocus ? 0.16 : neighborBand ? 0.08 : 0.03);
          ctx.lineWidth = lw + (l.predictedSupportTier === "high" ? 6.6 : 5.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(cx, cy, t.x, t.y);
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = lw + (l.predictedSupportTier === "high" ? 3.2 : 2.3);
          ctx.stroke();
          if (directlyTouchesFocus) {
            const edgeGradient = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
            edgeGradient.addColorStop(0, mixColor(color, 0.56));
            edgeGradient.addColorStop(0.5, color);
            edgeGradient.addColorStop(1, mixColor(color, 0.62));
            ctx.strokeStyle = edgeGradient;
          } else {
            ctx.strokeStyle = color;
          }
          ctx.lineWidth = lw;
          if (l.edge_type === "Predicted") ctx.setLineDash([4, 3]);
          if (l.edge_type === "Known+Predicted") ctx.setLineDash([8, 3]);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(cx, cy, t.x, t.y);
          ctx.stroke();
          if (inFocus) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.quadraticCurveTo(cx, cy, t.x, t.y);
            ctx.strokeStyle = sheenColor;
            ctx.lineWidth = Math.max(0.55, lw * (l.predictedSupportTier === "high" ? 0.44 : 0.34));
            ctx.stroke();
          }
          ctx.restore();
        }}
        linkDirectionalParticles={(l) => {
          if (!focusNeighbors || performanceMode || ultraDenseMode || graphData.links.length > 180) return 0;
          const s = linkNodeId(l.source);
          const t = linkNodeId(l.target);
          if (!(hoverId || selectedId)) return 0;
          if (s !== focusId && t !== focusId) return 0;
          return focusNeighbors.has(s) && focusNeighbors.has(t) ? 1 : 0;
        }}
        linkDirectionalParticleWidth={1.15}
        linkDirectionalParticleSpeed={0.0032}
        onNodeHover={(n) => {
          setHoverId(n?.id || "");
          if (!n) return onNodeHover?.(null);
          const evidence = nodeEvidence.get(n.id) || { Known: 0, Predicted: 0, "Known+Predicted": 0 };
          onNodeHover?.({
            id: n.id,
            label: n.display_name || n.label,
            node_type: n.node_type,
            degree: n.degree || 0,
            evidence,
            x: mouseRef.current.x,
            y: mouseRef.current.y
          });
        }}
        onNodeClick={(n) => {
          setSelectedId(n.id);
          const now = Date.now();
          const dbl = clickRef.current.id === n.id && now - clickRef.current.ts < 280;
          clickRef.current = { id: n.id, ts: now };
          if (dbl) {
            onNodeDoubleClick?.(n.id);
          } else {
            onNodeClick?.(n.id);
          }
        }}
      />
      <div className="graph-legend-inline">
        <div className="graph-legend-inline__title">Disease-centered network</div>
        <span><i className="dot drug" />Drug</span>
        <span><i className="dot target" />Target</span>
        <span className="is-disease-core"><i className="dot disease" />Disease core</span>
        <span><i className="dot ncrna" />ncRNA</span>
        <span><i className="line known" />Known</span>
        <span><i className="line predicted" />Predicted</span>
        <span><i className="line kp" />Known+Predicted</span>
        <span><i className="ring-mark" />Evidence Ring</span>
      </div>
      <div className="graph-hint">
        Wheel zoom · drag canvas pan · select node · double click expand
        {sampled ? ` · ${densityMode} · displaying ${graphData.links.length}/${graph.edges.length} edges` : ` · ${densityMode}`}
      </div>
    </div>
  );
}
