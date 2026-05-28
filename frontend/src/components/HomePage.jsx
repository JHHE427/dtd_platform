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

function HomeTableToggle({ collapsed, onToggle, label = "Detailed tables" }) {
  return (
    <div className="home-table-toggle-row">
      <button type="button" className="home-table-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <strong>{collapsed ? "Show" : "Hide"} {label}</strong>
      </button>
    </div>
  );
}

function HeroFlatNetworkVisual() {
  return (
    <svg viewBox="0 0 720 420" className="hero-flat-visual" aria-hidden="true">
      <defs>
        <linearGradient id="flatPanelFade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f7fbff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="720" height="420" rx="28" fill="url(#flatPanelFade)" />
      <g className="flat-grid">
        <path d="M56 82H664" />
        <path d="M56 154H664" />
        <path d="M56 226H664" />
        <path d="M56 298H664" />
        <path d="M128 44V364" />
        <path d="M256 44V364" />
        <path d="M384 44V364" />
        <path d="M512 44V364" />
      </g>
      <g className="flat-panel flat-panel-a">
        <rect x="52" y="54" width="168" height="78" rx="18" />
        <circle cx="88" cy="93" r="14" />
        <path d="M116 84H184" />
        <path d="M116 102H168" />
      </g>
      <g className="flat-panel flat-panel-b">
        <rect x="488" y="52" width="176" height="86" rx="18" />
        <path d="M524 96C546 70 578 72 590 94C600 112 628 116 646 86" />
        <circle cx="524" cy="96" r="7" />
        <circle cx="590" cy="94" r="7" />
        <circle cx="646" cy="86" r="7" />
      </g>
      <g className="flat-edges">
        <path d="M152 238C238 178 306 168 370 212" />
        <path d="M168 286C248 266 312 238 370 212" />
        <path d="M370 212C456 152 538 168 594 246" />
        <path d="M370 212C454 248 496 296 566 314" />
        <path d="M370 212C330 136 292 96 244 82" />
        <path d="M370 212C420 114 474 88 548 96" />
        <path d="M216 334C268 286 316 256 370 212" />
        <path d="M370 212C430 220 478 224 530 212" />
      </g>
      <g className="flat-ai-streams">
        <path d="M100 366C194 322 278 278 370 212" />
        <path d="M126 368C214 326 292 278 370 212" />
        <path d="M152 368C234 328 306 280 370 212" />
        <path d="M178 366C250 326 318 280 370 212" />
        <path d="M204 362C268 324 330 278 370 212" />
        <path d="M230 356C288 320 342 276 370 212" />
        <path d="M256 346C306 312 354 268 370 212" />
      </g>
      <g className="flat-node-group">
        <circle className="flat-node drug" cx="152" cy="238" r="17" />
        <circle className="flat-node drug" cx="168" cy="286" r="12" />
        <circle className="flat-node drug" cx="216" cy="334" r="13" />
        <circle className="flat-node target" cx="244" cy="82" r="14" />
        <circle className="flat-node target" cx="548" cy="96" r="13" />
        <circle className="flat-node target" cx="594" cy="246" r="15" />
        <circle className="flat-node ncrna" cx="530" cy="212" r="12" />
        <circle className="flat-node ncrna" cx="566" cy="314" r="11" />
        <circle className="flat-node disease" cx="370" cy="212" r="30" />
        <circle className="flat-node disease-ring" cx="370" cy="212" r="44" />
      </g>
      <g className="flat-molecule" transform="translate(486 278)">
        <path d="M18 28L48 12L80 28L80 64L48 82L18 64Z" />
        <path d="M48 12V42L80 64" />
        <path d="M18 64L48 42" />
        <circle cx="18" cy="28" r="5" />
        <circle cx="80" cy="28" r="5" />
        <circle cx="48" cy="82" r="5" />
      </g>
    </svg>
  );
}

function SevenModelMiniVisual() {
  return (
    <svg viewBox="0 0 260 150" className="home-mini-visual home-mini-visual-models" aria-hidden="true">
      <rect x="12" y="12" width="236" height="126" rx="18" />
      {[0, 1, 2, 3, 4, 5, 6].map((item) => (
        <path key={item} d={`M38 ${34 + item * 14}C86 ${34 + item * 14} 104 74 132 75C162 76 174 ${70 - item * 5} 222 64`} />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((item) => (
        <circle key={item} className={`mini-dot dot-${item}`} cx="38" cy={34 + item * 14} r="5" />
      ))}
      <circle className="mini-core" cx="132" cy="75" r="18" />
      <circle className="mini-core-ring" cx="132" cy="75" r="29" />
      <rect className="mini-output" x="196" y="48" width="34" height="34" rx="10" />
      <path className="mini-output-line" d="M202 92H232" />
      <path className="mini-output-line" d="M202 106H224" />
    </svg>
  );
}

function EvidenceLayerMiniVisual() {
  return (
    <svg viewBox="0 0 260 150" className="home-mini-visual home-mini-visual-layers" aria-hidden="true">
      <rect x="12" y="12" width="236" height="126" rx="18" />
      <rect className="mini-layer layer-1" x="46" y="34" width="168" height="20" rx="10" />
      <rect className="mini-layer layer-2" x="34" y="62" width="192" height="20" rx="10" />
      <rect className="mini-layer layer-3" x="54" y="90" width="152" height="20" rx="10" />
      <path className="mini-layer-link" d="M84 54V62" />
      <path className="mini-layer-link" d="M132 82V90" />
      <path className="mini-layer-link" d="M184 54V62" />
      <circle className="mini-layer-dot drug" cx="72" cy="72" r="6" />
      <circle className="mini-layer-dot target" cx="132" cy="44" r="6" />
      <circle className="mini-layer-dot disease" cx="178" cy="100" r="6" />
      <circle className="mini-layer-dot ncrna" cx="204" cy="72" r="6" />
    </svg>
  );
}

function DiseaseMapMiniVisual() {
  return (
    <svg viewBox="0 0 260 150" className="home-mini-visual home-mini-visual-map" aria-hidden="true">
      <rect x="12" y="12" width="236" height="126" rx="18" />
      <g className="mini-map-edges">
        <path d="M126 74C96 44 66 44 48 62" />
        <path d="M126 74C102 100 74 110 50 98" />
        <path d="M126 74C150 46 180 38 212 52" />
        <path d="M126 74C154 88 178 100 220 98" />
        <path d="M126 74C134 104 126 118 110 126" />
        <path d="M126 74C118 48 124 34 142 26" />
      </g>
      <circle className="mini-map-node disease" cx="126" cy="74" r="20" />
      <circle className="mini-map-node disease-ring" cx="126" cy="74" r="32" />
      <circle className="mini-map-node drug" cx="48" cy="62" r="8" />
      <circle className="mini-map-node drug" cx="50" cy="98" r="7" />
      <circle className="mini-map-node target" cx="212" cy="52" r="8" />
      <circle className="mini-map-node target" cx="220" cy="98" r="7" />
      <circle className="mini-map-node ncrna" cx="110" cy="126" r="7" />
      <circle className="mini-map-node target" cx="142" cy="26" r="6" />
    </svg>
  );
}

function ReleaseDatabaseMiniVisual() {
  return (
    <svg viewBox="0 0 260 150" className="home-mini-visual home-mini-visual-db" aria-hidden="true">
      <rect x="12" y="12" width="236" height="126" rx="18" />
      <g className="mini-db-table">
        <rect x="38" y="34" width="78" height="82" rx="12" />
        <path d="M50 54H104" />
        <path d="M50 74H104" />
        <path d="M50 94H88" />
      </g>
      <path className="mini-db-arrow" d="M124 76H154" />
      <path className="mini-db-arrow-head" d="M148 68L156 76L148 84" />
      <g className="mini-db-api">
        <rect x="166" y="38" width="56" height="72" rx="14" />
        <circle cx="194" cy="62" r="9" />
        <path d="M180 84H208" />
        <path d="M184 98H204" />
      </g>
    </svg>
  );
}

function MoleculeFigureVisual() {
  return (
    <svg viewBox="0 0 360 172" className="home-atlas-visual home-atlas-visual-molecule" aria-hidden="true">
      <rect x="12" y="12" width="336" height="148" rx="24" />
      <g className="atlas-soft-grid">
        <path d="M42 48H318" />
        <path d="M42 86H318" />
        <path d="M42 124H318" />
        <path d="M80 32V142" />
        <path d="M150 32V142" />
        <path d="M220 32V142" />
        <path d="M290 32V142" />
      </g>
      <g className="atlas-molecule-core">
        <path d="M98 70L132 50L168 70V110L132 130L98 110Z" />
        <path d="M168 70L204 50L238 70V110L204 130L168 110" />
        <path d="M132 50V32" />
        <path d="M238 70L270 52" />
        <path d="M204 130V150" />
        <circle className="atom drug" cx="132" cy="50" r="8" />
        <circle className="atom target" cx="204" cy="50" r="8" />
        <circle className="atom disease" cx="270" cy="52" r="8" />
        <circle className="atom ncrna" cx="204" cy="130" r="8" />
      </g>
      <g className="atlas-score-bars">
        <rect x="42" y="136" width="34" height="6" rx="3" />
        <rect x="42" y="124" width="56" height="6" rx="3" />
        <rect x="42" y="112" width="44" height="6" rx="3" />
      </g>
    </svg>
  );
}

function TargetProteinFigureVisual() {
  return (
    <svg viewBox="0 0 360 172" className="home-atlas-visual home-atlas-visual-protein" aria-hidden="true">
      <rect x="12" y="12" width="336" height="148" rx="24" />
      <g className="protein-ribbon">
        <path d="M58 112C88 54 128 54 154 96C178 134 220 128 236 82C252 34 296 48 316 86" />
        <path d="M58 112C90 88 122 92 154 96C190 100 206 104 236 82C264 62 288 66 316 86" />
      </g>
      <g className="protein-sites">
        <circle className="site site-a" cx="154" cy="96" r="14" />
        <circle className="site site-b" cx="236" cy="82" r="13" />
        <circle className="site site-c" cx="92" cy="82" r="9" />
      </g>
      <g className="sequence-bars">
        <rect x="50" y="132" width="42" height="7" rx="4" />
        <rect x="102" y="132" width="28" height="7" rx="4" />
        <rect x="140" y="132" width="64" height="7" rx="4" />
        <rect x="214" y="132" width="38" height="7" rx="4" />
        <rect x="262" y="132" width="48" height="7" rx="4" />
      </g>
      <path className="target-crosslink" d="M154 96L236 82" />
    </svg>
  );
}

function DiseaseHeatmapFigureVisual() {
  const rows = [
    [2, 3, 4, 2, 1, 3, 4],
    [1, 2, 5, 4, 2, 1, 3],
    [3, 4, 5, 5, 4, 3, 2],
    [2, 2, 3, 4, 5, 4, 3],
    [1, 3, 2, 3, 4, 5, 4],
  ];
  return (
    <svg viewBox="0 0 360 172" className="home-atlas-visual home-atlas-visual-heatmap" aria-hidden="true">
      <rect x="12" y="12" width="336" height="148" rx="24" />
      <g className="heatmap-cells">
        {rows.map((row, rowIndex) =>
          row.map((value, colIndex) => (
            <rect
              key={`${rowIndex}-${colIndex}`}
              className={`heat heat-${value}`}
              x={64 + colIndex * 28}
              y={38 + rowIndex * 22}
              width="20"
              height="14"
              rx="5"
            />
          ))
        )}
      </g>
      <g className="heatmap-side-network">
        <path d="M262 62C284 46 306 48 320 68" />
        <path d="M262 62C284 78 300 92 320 110" />
        <path d="M262 62C270 92 260 114 240 128" />
        <circle className="disease" cx="262" cy="62" r="15" />
        <circle className="drug" cx="320" cy="68" r="8" />
        <circle className="target" cx="320" cy="110" r="8" />
        <circle className="ncrna" cx="240" cy="128" r="7" />
      </g>
      <path className="heatmap-axis" d="M54 32V148H230" />
    </svg>
  );
}

function TtdValidationFigureVisual() {
  return (
    <svg viewBox="0 0 360 172" className="home-atlas-visual home-atlas-visual-ttd" aria-hidden="true">
      <rect x="12" y="12" width="336" height="148" rx="24" />
      <g className="ttd-badge">
        <rect x="40" y="44" width="78" height="84" rx="18" />
        <circle cx="79" cy="78" r="16" />
        <path d="M58 106H100" />
        <path d="M64 118H94" />
      </g>
      <g className="ttd-flow">
        <path d="M128 86H166" />
        <path d="M160 78L168 86L160 94" />
        <rect x="180" y="44" width="46" height="84" rx="14" />
        <rect x="246" y="44" width="46" height="84" rx="14" />
        <path d="M226 86H246" />
        <circle className="drug" cx="203" cy="66" r="8" />
        <circle className="target" cx="203" cy="106" r="8" />
        <circle className="disease" cx="269" cy="86" r="14" />
      </g>
      <g className="ttd-checks">
        <path d="M306 58L313 65L326 50" />
        <path d="M306 88L313 95L326 80" />
        <path d="M306 118L313 125L326 110" />
      </g>
    </svg>
  );
}

function NcrnaLinkFigureVisual() {
  return (
    <svg viewBox="0 0 360 172" className="home-atlas-visual home-atlas-visual-rna" aria-hidden="true">
      <rect x="12" y="12" width="336" height="148" rx="24" />
      <path className="rna-thread" d="M58 92C82 42 124 42 140 90C154 132 198 130 214 84C232 30 286 50 306 92" />
      <g className="rna-base-pairs">
        <path d="M78 68H116" />
        <path d="M86 86H132" />
        <path d="M158 112H196" />
        <path d="M224 72H280" />
        <path d="M236 94H304" />
      </g>
      <g className="rna-network">
        <path d="M140 90L212 84" />
        <path d="M212 84L268 124" />
        <path d="M140 90L94 126" />
        <circle className="ncrna" cx="140" cy="90" r="15" />
        <circle className="drug" cx="94" cy="126" r="9" />
        <circle className="target" cx="212" cy="84" r="10" />
        <circle className="disease" cx="268" cy="124" r="12" />
      </g>
    </svg>
  );
}

function PipelineFunnelFigureVisual() {
  return (
    <svg viewBox="0 0 360 172" className="home-atlas-visual home-atlas-visual-pipeline" aria-hidden="true">
      <rect x="12" y="12" width="336" height="148" rx="24" />
      <g className="pipeline-funnel">
        <path d="M52 42H308L276 72H84Z" />
        <path d="M84 78H276L248 106H112Z" />
        <path d="M112 112H248L220 140H140Z" />
      </g>
      <g className="pipeline-models">
        <circle cx="68" cy="58" r="5" />
        <circle cx="90" cy="58" r="5" />
        <circle cx="112" cy="58" r="5" />
        <circle cx="134" cy="58" r="5" />
        <circle cx="156" cy="58" r="5" />
        <circle cx="178" cy="58" r="5" />
        <circle cx="200" cy="58" r="5" />
      </g>
      <g className="pipeline-output">
        <circle className="disease" cx="180" cy="126" r="13" />
        <circle className="ring" cx="180" cy="126" r="22" />
        <path d="M202 126H250" />
        <path d="M250 126L242 118" />
        <path d="M250 126L242 134" />
      </g>
    </svg>
  );
}

function ReleaseStoryboardVisual() {
  return (
    <svg viewBox="0 0 760 230" className="home-storyboard-visual" aria-hidden="true">
      <rect className="storyboard-bg" x="8" y="8" width="744" height="214" rx="30" />
      <g className="storyboard-grid">
        <path d="M54 58H706" />
        <path d="M54 116H706" />
        <path d="M54 174H706" />
        <path d="M152 34V198" />
        <path d="M304 34V198" />
        <path d="M456 34V198" />
        <path d="M608 34V198" />
      </g>
      <g className="storyboard-links">
        <path d="M118 116C184 66 238 66 304 116" />
        <path d="M304 116C374 164 424 164 494 116" />
        <path d="M494 116C562 66 612 70 682 116" />
        <path d="M118 116C238 164 376 166 682 116" />
      </g>
      <g className="storyboard-stage stage-models">
        <rect x="46" y="66" width="142" height="100" rx="22" />
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <circle key={item} cx={72 + item * 16} cy={100 + (item % 2) * 24} r="6" />
        ))}
        <circle className="stage-core" cx="150" cy="116" r="16" />
      </g>
      <g className="storyboard-stage stage-evidence">
        <rect x="236" y="54" width="150" height="124" rx="22" />
        <rect className="layer layer-a" x="264" y="78" width="94" height="15" rx="8" />
        <rect className="layer layer-b" x="256" y="108" width="110" height="15" rx="8" />
        <rect className="layer layer-c" x="272" y="138" width="78" height="15" rx="8" />
      </g>
      <g className="storyboard-stage stage-disease">
        <rect x="436" y="50" width="150" height="132" rx="24" />
        <path d="M510 116C486 92 462 94 452 112" />
        <path d="M510 116C536 90 560 94 572 112" />
        <path d="M510 116C486 142 464 148 448 134" />
        <path d="M510 116C538 142 562 148 580 132" />
        <circle className="disease" cx="510" cy="116" r="24" />
        <circle className="ring" cx="510" cy="116" r="36" />
        <circle className="drug" cx="452" cy="112" r="8" />
        <circle className="target" cx="572" cy="112" r="8" />
        <circle className="ncrna" cx="448" cy="134" r="7" />
        <circle className="target" cx="580" cy="132" r="7" />
      </g>
      <g className="storyboard-stage stage-release">
        <rect x="628" y="66" width="86" height="100" rx="22" />
        <path d="M650 96H692" />
        <path d="M650 116H692" />
        <path d="M650 136H680" />
        <circle className="api-dot" cx="671" cy="78" r="7" />
      </g>
      <g className="storyboard-pulses">
        <circle cx="304" cy="116" r="4" />
        <circle cx="494" cy="116" r="4" />
        <circle cx="682" cy="116" r="4" />
      </g>
    </svg>
  );
}

function AdvancedEvidenceConsoleVisual() {
  const heatmap = [
    [2, 4, 5, 3, 2, 5, 4, 3],
    [1, 3, 4, 5, 4, 3, 5, 2],
    [3, 5, 5, 4, 2, 4, 3, 5],
    [2, 4, 3, 5, 5, 4, 2, 4],
    [4, 5, 4, 3, 5, 2, 3, 4],
  ];
  return (
    <svg viewBox="0 0 980 360" className="home-evidence-console-visual" aria-hidden="true">
      <defs>
        <linearGradient id="consoleHalo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f4f8ff" />
        </linearGradient>
      </defs>
      <rect className="console-shell" x="10" y="10" width="960" height="340" rx="34" fill="url(#consoleHalo)" />
      <g className="console-grid">
        {[70, 120, 170, 220, 270, 320].map((y) => <path key={`h-${y}`} d={`M48 ${y}H932`} />)}
        {[150, 300, 450, 600, 750, 900].map((x) => <path key={`v-${x}`} d={`M${x} 42V318`} />)}
      </g>

      <g className="console-model-matrix">
        <rect x="48" y="50" width="230" height="260" rx="24" />
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <g key={row} className="model-row">
            <circle cx="78" cy={82 + row * 29} r="7" />
            {[0, 1, 2, 3, 4, 5].map((col) => (
              <rect
                key={`${row}-${col}`}
                className={`model-cell cell-${((row + col) % 5) + 1}`}
                x={106 + col * 24}
                y={75 + row * 29}
                width="16"
                height="14"
                rx="5"
              />
            ))}
            <path d={`M106 ${101 + row * 29}H236`} />
          </g>
        ))}
      </g>

      <g className="console-core-network">
        <rect x="316" y="42" width="350" height="276" rx="30" />
        <g className="network-rings">
          <circle cx="491" cy="180" r="112" />
          <circle cx="491" cy="180" r="78" />
          <circle cx="491" cy="180" r="44" />
        </g>
        <g className="network-links">
          <path d="M491 180C448 130 400 118 362 142" />
          <path d="M491 180C434 190 386 220 360 266" />
          <path d="M491 180C536 116 588 96 630 128" />
          <path d="M491 180C548 190 594 224 632 270" />
          <path d="M491 180C468 102 484 72 530 58" />
          <path d="M491 180C506 254 484 294 438 306" />
          <path d="M362 142C420 78 532 58 630 128" />
          <path d="M360 266C430 316 548 316 632 270" />
        </g>
        <g className="network-nodes">
          <circle className="disease-main" cx="491" cy="180" r="28" />
          <circle className="disease-ring" cx="491" cy="180" r="43" />
          <circle className="drug" cx="362" cy="142" r="12" />
          <circle className="drug" cx="360" cy="266" r="10" />
          <circle className="target" cx="630" cy="128" r="12" />
          <circle className="target" cx="632" cy="270" r="10" />
          <circle className="ncrna" cx="530" cy="58" r="10" />
          <circle className="ncrna" cx="438" cy="306" r="9" />
          <circle className="drug" cx="430" cy="96" r="7" />
          <circle className="target" cx="574" cy="88" r="7" />
          <circle className="disease-small" cx="404" cy="238" r="8" />
          <circle className="disease-small" cx="584" cy="230" r="8" />
        </g>
      </g>

      <g className="console-score-panel">
        <rect x="704" y="50" width="226" height="260" rx="24" />
        <g className="score-heatmap">
          {heatmap.map((row, rowIndex) =>
            row.map((value, colIndex) => (
              <rect
                key={`${rowIndex}-${colIndex}`}
                className={`heat-${value}`}
                x={732 + colIndex * 20}
                y={78 + rowIndex * 22}
                width="14"
                height="14"
                rx="4"
              />
            ))
          )}
        </g>
        <g className="score-bars">
          <rect className="bar-bg" x="730" y="210" width="160" height="9" rx="5" />
          <rect className="bar-a" x="730" y="210" width="132" height="9" rx="5" />
          <rect className="bar-bg" x="730" y="236" width="160" height="9" rx="5" />
          <rect className="bar-b" x="730" y="236" width="104" height="9" rx="5" />
          <rect className="bar-bg" x="730" y="262" width="160" height="9" rx="5" />
          <rect className="bar-c" x="730" y="262" width="142" height="9" rx="5" />
        </g>
        <g className="score-orbits">
          <circle cx="888" cy="108" r="14" />
          <circle cx="888" cy="108" r="28" />
          <path d="M860 108H832" />
          <path d="M888 136V166" />
        </g>
      </g>

      <g className="console-evidence-rails">
        <path d="M278 98C306 98 306 98 316 98" />
        <path d="M278 180C306 180 306 180 316 180" />
        <path d="M278 262C306 262 306 262 316 262" />
        <path d="M666 116C692 116 692 116 704 116" />
        <path d="M666 180C692 180 692 180 704 180" />
        <path d="M666 244C692 244 692 244 704 244" />
      </g>
      <g className="console-data-tokens">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <circle key={item} cx={296 + item * 62} cy="334" r={item % 2 ? 5 : 7} />
        ))}
      </g>
    </svg>
  );
}

export default function HomePage({ stats, researchSummary, onAnalyze, onOpenDatabase }) {
  const [keyword, setKeyword] = React.useState("");
  const [collapsedTables, setCollapsedTables] = React.useState({
    inventoryPanel: true,
    formalTablesPanel: true,
    keyFindingsPanel: true,
    fixedCasesPanel: true,
    aiBrandPanel: true,
    heroFeaturePanel: true,
    diseaseContextEvidence: true,
    diseaseLinkedContext: true,
    ttdValidation: true,
    ttdSupported: true,
    targetModule: true,
    diseaseModule: true,
    modelOverview: true,
    sevenModelIntro: true,
    diseaseEvidencePanel: true,
    diseaseReleasedPanel: true,
    ttdValidationPanel: true,
    ttdSupportedPanel: true,
    targetModulePanel: true,
    diseaseModulePanel: true,
    modelSummaryPanel: true,
    resultAccessPanel: true,
    constructionPanel: true,
    voteOverviewPanel: true,
    dtiConsistencyPanel: true,
    methodConsistencyPanel: true,
    screeningMapPanel: true,
    resultSummaryPanel: true,
    workflowPanel: true,
    algoSummaryPanel: true,
    methodMatrixPanel: true,
    sourceDatasetPanel: true,
    approvedValidationPanel: true,
    diseaseDistributionPanel: true,
    selectedClinicalPanel: true,
    pipelineShrinkagePanel: true,
  });
  const toggleTableSection = React.useCallback((key) => {
    setCollapsedTables((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
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
  const ncrnaSummary = researchSummary?.ncrna_summary || null;
  const ncrnaOverview = ncrnaSummary?.overview || null;
  const ttdSummary = researchSummary?.ttd_summary || null;
  const ttdOverview = ttdSummary?.overview || null;
  const ttdSupportedResults = researchSummary?.ttd_supported_results || null;
  const ttdSupportedOverview = ttdSupportedResults?.overview || null;
  const targetCentricModule = researchSummary?.target_centric_module || null;
  const targetCentricOverview = targetCentricModule?.overview || null;
  const targetCentricRows = targetCentricModule?.rows || [];
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
  const diseaseCentricModule = researchSummary?.disease_centric_module || null;
  const diseaseCentricOverview = diseaseCentricModule?.overview || null;
  const diseaseCentricRows = diseaseCentricModule?.rows || [];
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
  const ncrnaLinkedDrugMap = React.useMemo(
    () => Object.fromEntries(ncrnaLinkedDrugs.map((item) => [item.drug_id, item])),
    [ncrnaLinkedDrugs]
  );
  const ncrnaLinkedApprovedMap = React.useMemo(
    () => Object.fromEntries(
      ncrnaLinkedApprovedRows.map((item) => [`${item.drug_id}|${item.target_id}|${item.disease_id}`, item])
    ),
    [ncrnaLinkedApprovedRows]
  );
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
      title: "Formal disease layer",
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
      value: pipelineShrinkage ? `${(pipelineShrinkage.release_filtered_pairs || pipelineShrinkage.vote4_retained).toLocaleString()} retained` : "NA",
      note: pipelineShrinkage ? `from ${pipelineShrinkage.raw_dti_pairs.toLocaleString()} raw DTI pairs into the current release-filtered DTI layer.` : "Pipeline retention summary is unavailable.",
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
    {
      title: "ncRNA-linked release coverage",
      value: ncrnaLinkedOverview ? `${ncrnaLinkedOverview.released_row_count || 0} rows` : "NA",
      note: ncrnaLinkedOverview
        ? `${ncrnaLinkedOverview.consensus_row_count || 0} consensus rows and ${ncrnaLinkedOverview.selected_approved_row_count || 0} selected approved-drug rows are cross-linked to curated ncRNA evidence.`
        : "ncRNA-linked released-result coverage is unavailable.",
    },
    {
      title: "TTD-supported release coverage",
      value: ttdOverview ? `${ttdOverview.ttd_supported_released_rows || 0} rows` : "NA",
      note: ttdOverview
        ? `${ttdOverview.ttd_drug_disease_supported_rows || 0} rows overlap TTD drug-disease mappings and ${ttdOverview.ttd_target_disease_supported_rows || 0} rows overlap TTD target-disease mappings.`
        : "TTD overlap summary is unavailable.",
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
      conclusion: "This disease-centered summary highlights the dominant retained drug-target context within the released disease network.",
    } : null,
  ].filter(Boolean);
  const featureCards = [
    {
      title: "Released Evidence Layers",
      body: "Curated known associations and retained prediction rows are organized into a unified release-facing evidence structure."
    },
    {
      title: "Network Query and Analysis",
      body: "The released disease network supports graph navigation, local expansion, node inspection, and subnetwork comparison within the network analysis view."
    },
    {
      title: "Structured Record Annotations",
      body: "Chemical structures, SMILES, target sequences, ontology terms, summaries, and evidence context are presented within structured network records."
    }
  ];
  const releasedPredictionTotal = Number(predictionSummary?.total_rows || predictionResultTotal || 0);
  const releasedDiseaseLinkedTotal = Number(releasedDiseaseSummary?.released_rows || 0);
  const consensusTotal = Number(supportTierOverview?.high_consensus_rows || highConsensusCases.length || 0);
  const approvedResultTotal = Number(approvedValidation?.retained_final || approvedDrugDeepResults.length || 0);
  const coveredDiseases = Number(researchSummary?.overview?.diseases || nodeMap.Disease || 0);
  const visualCards = [
    {
      title: "Seven-model consensus",
      body: "DTI scores converge into retained disease-network candidates.",
      visual: <SevenModelMiniVisual />,
    },
    {
      title: "Evidence layer fusion",
      body: "DrugBank, CTD, TTD, OpenTargets, and ncRNA evidence are harmonized.",
      visual: <EvidenceLayerMiniVisual />,
    },
    {
      title: "Disease-centered graph",
      body: "Local subnetworks expose drug, target, disease, and ncRNA context.",
      visual: <DiseaseMapMiniVisual />,
    },
    {
      title: "Formal release database",
      body: "Curated tables feed stable API records and platform views.",
      visual: <ReleaseDatabaseMiniVisual />,
    },
  ];
  const atlasVisualCards = [
    {
      title: "Chemical structure layer",
      metric: `${(nodeMap.Drug || 0).toLocaleString()} drug nodes`,
      body: "SMILES, molecular formula, and structure-ready annotations are surfaced for drug records.",
      visual: <MoleculeFigureVisual />,
    },
    {
      title: "Target protein context",
      metric: `${(nodeMap.Target || 0).toLocaleString()} target nodes`,
      body: "Protein and gene records retain identifiers, sequence context, and disease cross-links.",
      visual: <TargetProteinFigureVisual />,
    },
    {
      title: "Disease evidence heatmap",
      metric: `${coveredDiseases.toLocaleString()} diseases`,
      body: "Disease nodes are emphasized as the central interpretation layer for platform review.",
      visual: <DiseaseHeatmapFigureVisual />,
    },
    {
      title: "TTD validation layer",
      metric: `${Number(ttdOverview?.ttd_supported_released_rows || 0).toLocaleString()} supported rows`,
      body: "Therapeutic Target Database mappings provide external target-drug-disease validation.",
      visual: <TtdValidationFigureVisual />,
    },
    {
      title: "ncRNA bridge evidence",
      metric: `${Number(ncrnaLinkedOverview?.released_row_count || ncrnaOverview?.human_evidence_rows || 0).toLocaleString()} linked rows`,
      body: "Curated ncRNA-drug evidence is connected back to disease-centered released results.",
      visual: <NcrnaLinkFigureVisual />,
    },
    {
      title: "AI release funnel",
      metric: `${dtiModelCoverage.length || sevenDtiModels.length} DTI models`,
      body: "Seven model outputs are filtered into compact, queryable, release-grade network records.",
      visual: <PipelineFunnelFigureVisual />,
    },
  ];
  const consoleMetricRows = [
    {
      label: "Released AI rows",
      value: releasedPredictionTotal,
      note: "formal prediction layer",
    },
    {
      label: "High-consensus rows",
      value: consensusTotal,
      note: "multi-method support",
    },
    {
      label: "TTD supported",
      value: Number(ttdOverview?.ttd_supported_released_rows || 0),
      note: "external validation",
    },
    {
      label: "ncRNA-linked",
      value: Number(ncrnaLinkedOverview?.released_row_count || ncrnaOverview?.human_evidence_rows || 0),
      note: "multimodal bridge",
    },
  ];
  const consoleMetricMax = Math.max(1, ...consoleMetricRows.map((item) => item.value || 0));

  return (
    <section className="page is-active home-page">
      <div className="hero">
        <div className="hero-top-grid">
          <div className="hero-copy">
            <div className="hero-pill">DiseaseMind Formal Release</div>
            <h1>
              DiseaseMind
              <span>AI Disease Network Atlas</span>
            </h1>
            <p>
              Explore a disease-centered AI network release that unifies seven deep learning DTI models, retained prediction rows, and curated evidence across drug, target, disease, and ncRNA layers.
            </p>
            <div className="hero-search">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAnalyze(keyword)}
                placeholder="Search by DrugBank ID, target ID, disease name, ncRNA name, or alias..."
              />
              <button onClick={() => onAnalyze(keyword)}>Access Network Analysis</button>
            </div>
            <div className="hero-ai-strip">
              <span className="ai-brand-chip">7 deep models</span>
              {topDtiModel ? <span className="ai-brand-chip">top {topDtiModel.model}</span> : null}
              {topDtiModel?.avg_score != null ? <span className="ai-brand-chip">avg {topDtiModel.avg_score}</span> : null}
              {topDtiPair ? <span className="ai-brand-chip">{topDtiPair.pair_label}</span> : null}
              {topDtiPattern ? <span className="ai-brand-chip">{topDtiPattern.pattern_label}</span> : null}
            </div>
          </div>
          <figure className="hero-ai-visual">
            <HeroFlatNetworkVisual />
          </figure>
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
            <div className="stat-title">ncRNA Nodes</div>
            <div className="stat-value">{nodeMap.ncRNA || 0}</div>
          </article>
          <article className="stat-card">
            <div className="stat-title">Total Edges</div>
            <div className="stat-value">{edgeTotal}</div>
          </article>
        </div>
        <div className="home-visual-grid">
          {visualCards.map((item) => (
            <article className="home-visual-card" key={item.title}>
              {item.visual}
              <div className="home-visual-card-copy">
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            </article>
          ))}
        </div>
        <section className="home-storyboard-panel" aria-label="Release workflow storyboard">
          <div className="home-storyboard-copy">
            <span>Release Storyboard</span>
            <strong>DiseaseMind evidence flow</strong>
            <p>
              Seven DTI models, curated evidence, disease-centered expansion, and stable database records are presented as one closed release workflow.
            </p>
          </div>
          <ReleaseStoryboardVisual />
          <div className="home-storyboard-metrics">
            <span><strong>{(dtiModelCoverage.length || sevenDtiModels.length).toLocaleString()}</strong><em>DTI models</em></span>
            <span><strong>{releasedPredictionTotal.toLocaleString()}</strong><em>prediction rows</em></span>
            <span><strong>{releasedDiseaseLinkedTotal.toLocaleString()}</strong><em>disease-linked</em></span>
            <span><strong>{edgeTotal.toLocaleString()}</strong><em>network edges</em></span>
          </div>
        </section>
        <section className="home-evidence-console" aria-label="AI evidence console">
          <div className="home-evidence-console-head">
            <div>
              <span>AI Evidence Console</span>
              <strong>Multimodal scoring cockpit for formal disease-network release</strong>
              <p>
                A denser systems view that combines seven-model vote structure, disease-centered graph topology, heatmap-style AI confidence, external TTD support, and ncRNA evidence.
              </p>
            </div>
            <button type="button" onClick={() => onAnalyze(keyword)}>Inspect in network</button>
          </div>
          <div className="home-evidence-console-body">
            <AdvancedEvidenceConsoleVisual />
            <div className="home-evidence-console-metrics">
              {consoleMetricRows.map((item) => (
                <article
                  className="console-metric-card"
                  key={item.label}
                  style={{ "--bar-pct": `${Math.max(8, Math.min(100, Math.round(((item.value || 0) / consoleMetricMax) * 100)))}%` }}
                >
                  <div>
                    <strong>{(item.value || 0).toLocaleString()}</strong>
                    <span>{item.label}</span>
                  </div>
                  <em>{item.note}</em>
                  <i aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="home-atlas-gallery" aria-label="Visual overview of the formal disease network release">
          <div className="home-atlas-gallery-head">
            <div>
              <strong>Visual Atlas Overview</strong>
              <span>Compact flat illustrations of the main data layers and released AI workflow.</span>
            </div>
            <button type="button" onClick={() => onOpenDatabase?.("nodes")}>Open full database</button>
          </div>
          <div className="home-atlas-gallery-grid">
            {atlasVisualCards.map((item) => (
              <article className="home-atlas-card" key={item.title}>
                {item.visual}
                <div className="home-atlas-card-copy">
                  <span className="home-atlas-card-metric">{item.metric}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="home-result-scale-card">
          <div className="home-result-scale-head">
            <strong>Release Result Scale</strong>
            <span>Current page tables are top-list previews. Full records are available in Database export.</span>
          </div>
          <div className="home-result-scale-grid">
            <span className="result-summary-pill">
              <strong>{releasedPredictionTotal.toLocaleString()}</strong>
              <em>Released prediction rows</em>
            </span>
            <span className="result-summary-pill">
              <strong>{releasedDiseaseLinkedTotal.toLocaleString()}</strong>
              <em>Disease-linked released rows</em>
            </span>
            <span className="result-summary-pill">
              <strong>{consensusTotal.toLocaleString()}</strong>
              <em>High-consensus rows</em>
            </span>
            <span className="result-summary-pill">
              <strong>{approvedResultTotal.toLocaleString()}</strong>
              <em>Approved-drug retained rows</em>
            </span>
            <span className="result-summary-pill">
              <strong>{coveredDiseases.toLocaleString()}</strong>
              <em>Disease nodes covered</em>
            </span>
          </div>
        </section>
        <HomeTableToggle
          collapsed={collapsedTables.heroFeaturePanel}
          onToggle={() => toggleTableSection("heroFeaturePanel")}
          label="hero feature strip"
        />
        {!collapsedTables.heroFeaturePanel ? (
          <div className="home-feature-strip">
            {featureCards.map((item) => (
              <article className="home-feature-card" key={item.title}>
                <div className="home-feature-title">{item.title}</div>
                <div className="home-feature-text">{item.body}</div>
              </article>
            ))}
          </div>
        ) : null}

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
            <div className="home-panel-subtitle">Compact index of the current release.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.inventoryPanel}
            onToggle={() => toggleTableSection("inventoryPanel")}
            label="release inventory"
          />
          {!collapsedTables.inventoryPanel ? (
            <div className="result-summary-strip">
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
                <strong>{resultTables.length}</strong>
                <em>Formal result tables</em>
              </span>
            </div>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide ai-brand-panel">
          <div className="home-panel-head">
            <h3>Disease AI Intelligence Layer</h3>
            <div className="home-panel-subtitle">Seven deep learning DTI models provide raw pair scores and vote support for the disease-centered release.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.aiBrandPanel}
            onToggle={() => toggleTableSection("aiBrandPanel")}
            label="AI intelligence layer"
          />
          {!collapsedTables.aiBrandPanel ? <>
          <div className="result-summary-strip ai-summary-strip">
            <span className="result-summary-pill ai-pill">
              <strong>7 models</strong>
              <em>GraphDTA · DTIAM · DrugBAN · DeepPurpose · DeepDTAGen · MolTrans · Conplex</em>
            </span>
            {topDtiModel ? (
              <span className="result-summary-pill ai-pill">
                <strong>{topDtiModel.model}</strong>
                <em>{topDtiModel.count} rows · avg {topDtiModel.avg_score ?? "-"}</em>
              </span>
            ) : null}
            {topDtiPair ? (
              <span className="result-summary-pill ai-pill">
                <strong>{topDtiPair.pair_label}</strong>
                <em>{topDtiPair.count} co-support rows</em>
              </span>
            ) : null}
            {topDtiPattern ? (
              <span className="result-summary-pill ai-pill">
                <strong>{topDtiPattern.pattern_label}</strong>
                <em>{topDtiPattern.count} released rows</em>
              </span>
            ) : null}
          </div>
          <div className="ai-model-chip-grid">
            {dtiModelCoverage.slice(0, 7).map((item) => {
              const meta = SEVEN_DTI_MODEL_META.find((x) => x.label === item.model);
              return (
                <article className={`ai-model-chip model-${meta?.key || "graphdta"}`} key={item.model}>
                  <strong>{item.model}</strong>
                  <span>{item.count} rows</span>
                  <span>avg {item.avg_score ?? "-"}</span>
                </article>
              );
            })}
          </div>
          </> : null}
        </section>

        <div className="home-priority-grid">
          <div className="home-priority-stack">
            <section className="home-panel-card">
              <div className="home-panel-head">
                <h3>Key Findings</h3>
                <div className="home-panel-subtitle">Short release-level findings.</div>
              </div>
              <HomeTableToggle
                collapsed={collapsedTables.keyFindingsPanel}
                onToggle={() => toggleTableSection("keyFindingsPanel")}
                label="key findings"
              />
              {!collapsedTables.keyFindingsPanel ? (
                <div className="key-findings-grid">
                  {keyFindings.map((item) => (
                    <article className="key-finding-card" key={item.title}>
                      <div className="key-finding-title">{item.title}</div>
                      <div className="key-finding-value">{item.value}</div>
                      <div className="key-finding-note">{item.note}</div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
            <section className="home-panel-card">
              <div className="home-panel-head">
                <h3>Fixed Case Studies</h3>
              <div className="home-panel-subtitle">Pinned records for direct review.</div>
              </div>
              <HomeTableToggle
                collapsed={collapsedTables.fixedCasesPanel}
                onToggle={() => toggleTableSection("fixedCasesPanel")}
                label="fixed case studies"
              />
              {!collapsedTables.fixedCasesPanel ? (
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
              ) : null}
            </section>
          </div>

          <section className="home-panel-card home-seven-model-card home-priority-seven">
            <div className="home-panel-head">
              <h3>Seven DTI Models</h3>
              <div className="home-panel-subtitle">Seven upstream DTI models feed the released disease network.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.sevenModelIntro}
              onToggle={() => toggleTableSection("sevenModelIntro")}
              label="seven-model overview"
            />
            {!collapsedTables.sevenModelIntro ? (
            <>
            <div className="seven-model-section-note">
              <span className="seven-model-note-badge">Unified network palette</span>
              <span className="seven-model-note-text">The same model order and colors are reused across the site.</span>
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
                <em>Explicitly displayed in the network release</em>
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
                <span>Open released prediction rows and per-model support.</span>
              </button>
            </div>
            </>
            ) : null}
          </section>
        </div>

        {ncrnaOverview ? (
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Disease-Context Evidence Layer</h3>
              <div className="home-panel-subtitle">Curated evidence retained as a disease-context knowledge layer.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.diseaseEvidencePanel}
              onToggle={() => toggleTableSection("diseaseEvidencePanel")}
              label="disease-context module"
            />
            {!collapsedTables.diseaseEvidencePanel ? (
            <>
            <div className="layer-legend-strip">
              <span className="layer-legend-pill is-known-only">
                <strong>Disease-context input</strong>
                <em>Curated ncRNA-drug evidence</em>
              </span>
              <span className="layer-legend-pill is-release-layer">
                <strong>Released prediction layer</strong>
                <em>Drug-target-disease result rows</em>
              </span>
              <span className="layer-legend-pill is-cross-layer">
                <strong>Cross-layer linkage</strong>
                <em>Shared drugs connect ncRNA evidence to released results</em>
              </span>
            </div>
            <div className="home-conclusion-grid">
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Human ncRNA evidence rows</div>
                <div className="home-conclusion-value">{ncrnaOverview.evidence_rows}</div>
                <div className="home-conclusion-note">Curated human-known ncRNA-drug records retained from ncRNADrug.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Unique ncRNA entries</div>
                <div className="home-conclusion-value">{ncrnaOverview.unique_ncrnas}</div>
                <div className="home-conclusion-note">Distinct ncRNA labels across miRNA, lncRNA, and circRNA evidence rows.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Unique drug entries</div>
                <div className="home-conclusion-value">{ncrnaOverview.unique_drugs}</div>
                <div className="home-conclusion-note">Distinct drugs linked to known ncRNA evidence in the human subset.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Top ncRNA type</div>
                <div className="home-conclusion-value">{ncrnaOverview.top_ncrna_type || "NA"}</div>
                <div className="home-conclusion-note">Dominant ncRNA class in the curated human evidence layer.</div>
              </article>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{ncrnaOverview.unique_edges}</strong>
                <em>Unique ncRNA-drug edges</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaOverview.unique_drugbank_ids}</strong>
                <em>Distinct DrugBank IDs</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaOverview.top_relation_category || "NA"}</strong>
                <em>Leading curated relation layer</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaOverview.approved_rows || 0}</strong>
                <em>Approved-labeled evidence rows</em>
              </span>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.diseaseContextEvidence}
              onToggle={() => toggleTableSection("diseaseContextEvidence")}
              label="disease-context evidence tables"
            />
            {!collapsedTables.diseaseContextEvidence ? (
            <>
            <div className="home-result-two-col">
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
                    {ncrnaTopNcrnas.length ? ncrnaTopNcrnas.slice(0, 10).map((row) => (
                      <tr key={row.ncRNA_Name}>
                        <td>{row.ncrna_id ? (
                          <button className="result-link-btn" onClick={() => onAnalyze(row.ncrna_id)}>
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
                      <th>Top drug</th>
                      <th>DrugBank ID</th>
                      <th>Evidence rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ncrnaTopDrugs.length ? ncrnaTopDrugs.slice(0, 10).map((row) => (
                      <tr key={`${row.Drug_Name}-${row.DrugBank_ID || "NA"}`}>
                        <td>{row.DrugBank_ID ? (
                          <button className="result-link-btn" onClick={() => onAnalyze(row.DrugBank_ID)}>
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
            <div className="home-result-two-col">
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
            </>
            ) : null}
            </>
            ) : null}
          </section>
        ) : null}

        {ncrnaLinkedOverview ? (
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Disease-Linked Released Context</h3>
              <div className="home-panel-subtitle">Released rows linked back to curated disease-context evidence.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.diseaseReleasedPanel}
              onToggle={() => toggleTableSection("diseaseReleasedPanel")}
              label="disease-linked release module"
            />
            {!collapsedTables.diseaseReleasedPanel ? (
            <>
            <div className="layer-legend-strip">
              <span className="layer-legend-pill is-known-only">
                <strong>Input layer</strong>
                <em>Known ncRNA-drug evidence</em>
              </span>
              <span className="layer-legend-pill is-cross-layer">
                <strong>Linking rule</strong>
                <em>Drug overlap between curated evidence and released rows</em>
              </span>
              <span className="layer-legend-pill is-release-layer">
                <strong>Output layer</strong>
                <em>Released, consensus, and approved result rows</em>
              </span>
            </div>
            <div className="home-conclusion-grid">
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Released network overlap</div>
                <div className="home-conclusion-value">{ncrnaLinkedOverview.released_row_count || 0}</div>
                <div className="home-conclusion-note">Released rows currently intersecting the curated ncRNA-drug layer through shared drugs.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Consensus layer overlap</div>
                <div className="home-conclusion-value">{ncrnaLinkedOverview.consensus_row_count || 0}</div>
                <div className="home-conclusion-note">Consensus rows simultaneously retained by the released method layer and supported through ncRNA-linked drugs.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Approved-drug overlap</div>
                <div className="home-conclusion-value">{ncrnaLinkedOverview.selected_approved_row_count || 0}</div>
                <div className="home-conclusion-note">Selected approved-drug rows that also fall inside the curated ncRNA evidence layer.</div>
              </article>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{ncrnaLinkedOverview.released_row_count || 0}</strong>
                <em>Released rows linked to ncRNA evidence</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaLinkedOverview.consensus_row_count || 0}</strong>
                <em>Consensus rows linked to ncRNA evidence</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaLinkedOverview.selected_approved_row_count || 0}</strong>
                <em>Selected approved-drug rows with ncRNA evidence</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaLinkedOverview.linked_drug_count || 0}</strong>
                <em>Released drugs shared with the ncRNA layer</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaLinkedOverview.linked_ncrna_count || 0}</strong>
                <em>ncRNAs connected to released drugs</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ncrnaLinkedOverview.top_relation_category || "NA"}</strong>
                <em>Leading curated ncRNA relation</em>
              </span>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.diseaseLinkedContext}
              onToggle={() => toggleTableSection("diseaseLinkedContext")}
              label="disease-linked overlap tables"
            />
            {!collapsedTables.diseaseLinkedContext ? (
            <div className="home-result-two-col">
              <div className="result-table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>Linked drug</th>
                      <th>Released rows</th>
                      <th>Linked ncRNAs</th>
                      <th>Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ncrnaLinkedDrugs.length ? ncrnaLinkedDrugs.map((row) => (
                      <tr key={row.drug_id}>
                        <td>
                          <button className="result-link-btn" onClick={() => onAnalyze(row.drug_id)}>
                            <span className="result-emphasis-label">{row.drug_label}</span>
                          </button>
                        </td>
                        <td><span className="result-emphasis-number">{row.released_row_count}</span></td>
                        <td>{row.linked_ncrna_count}</td>
                        <td><span className="result-emphasis-chip">{row.max_algo_pass}/3 · {row.max_votes}/7</span></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>No released-result overlap with the ncRNA layer is available in the current release.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="result-table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>Linked consensus case</th>
                      <th>Disease</th>
                      <th>Top ncRNA</th>
                      <th>Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ncrnaLinkedConsensusCases.length ? ncrnaLinkedConsensusCases.slice(0, 10).map((row) => (
                      <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                        <td>
                          <button className="result-link-btn" onClick={() => onAnalyze(row.drug_id)}>
                            <span className="result-emphasis-label">{row.drug_label}</span>
                          </button>
                        </td>
                        <td>{row.disease_label}</td>
                        <td>{row.top_ncrna_name || "-"}</td>
                        <td><span className="result-emphasis-chip">{row.n_algo_pass}/3 · {row.Total_Votes_Optional7}/7</span></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>No consensus rows currently overlap with curated ncRNA-drug evidence.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}
            </>
            ) : null}
          </section>
        ) : null}

        {ttdOverview ? (
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>TTD Therapeutic Target Validation</h3>
              <div className="home-panel-subtitle">External therapeutic-target validation for released disease-network results.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.ttdValidationPanel}
              onToggle={() => toggleTableSection("ttdValidationPanel")}
              label="TTD validation module"
            />
            {!collapsedTables.ttdValidationPanel ? (
            <>
            <div className="layer-legend-strip">
              <span className="layer-legend-pill is-known-only">
                <strong>TTD knowledge layer</strong>
                <em>Target-drug-disease mappings and MOA annotations</em>
              </span>
              <span className="layer-legend-pill is-cross-layer">
                <strong>Validation rule</strong>
                <em>Overlap with released rows by drug, target, and disease identifiers</em>
              </span>
              <span className="layer-legend-pill is-release-layer">
                <strong>Released output</strong>
                <em>TTD-supported drugs, targets, and released rows</em>
              </span>
            </div>
            <div className="home-conclusion-grid">
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">TTD targets</div>
                <div className="home-conclusion-value">{ttdOverview.ttd_targets}</div>
                <div className="home-conclusion-note">Therapeutic targets available for validation and annotation.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">TTD-supported released rows</div>
                <div className="home-conclusion-value">{ttdOverview.ttd_supported_released_rows}</div>
                <div className="home-conclusion-note">Released rows overlapping TTD disease-linked knowledge.</div>
              </article>
              <article className="home-conclusion-card">
                <div className="home-conclusion-title">Leading MOA</div>
                <div className="home-conclusion-value">{ttdOverview.top_moa || "NA"}</div>
                <div className="home-conclusion-note">Most common mode-of-action label in the TTD drug-target layer.</div>
              </article>
            </div>
            <div className="result-summary-strip">
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_drug_disease_rows}</strong>
                <em>TTD drug-disease mappings</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_target_disease_rows}</strong>
                <em>TTD target-disease mappings</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_drug_target_moa_rows}</strong>
                <em>TTD drug-target MOA rows</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_drug_disease_supported_rows}</strong>
                <em>Released rows with TTD drug-disease support</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.ttd_target_disease_supported_rows}</strong>
                <em>Released rows with TTD target-disease support</em>
              </span>
              <span className="result-summary-pill">
                <strong>{ttdOverview.top_target_type || "NA"}</strong>
                <em>Leading TTD target class</em>
              </span>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.ttdValidation}
              onToggle={() => toggleTableSection("ttdValidation")}
              label="TTD validation tables"
            />
            {!collapsedTables.ttdValidation ? (
            <>
            <div className="home-result-two-col">
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
                    {ttdTopSupportedDrugs.length ? ttdTopSupportedDrugs.slice(0, 10).map((row) => (
                      <tr key={`${row.Drug_ID}-${row.Drug_Name}`}>
                        <td>{row.Drug_ID ? (
                          <button className="result-link-btn" onClick={() => onAnalyze(row.Drug_ID)}>
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
                    {ttdTopSupportedTargets.length ? ttdTopSupportedTargets.slice(0, 10).map((row) => (
                      <tr key={`${row.Target_ID}-${row.gene_name}`}>
                        <td>{row.Target_ID ? (
                          <button className="result-link-btn" onClick={() => onAnalyze(row.Target_ID)}>
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
            <div className="home-result-two-col">
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
            </>
            ) : null}
            </>
            ) : null}
          </section>
        ) : null}
        {ttdSupportedOverview ? (
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>TTD-Supported Released Results</h3>
              <div className="home-panel-subtitle">Released rows with extra therapeutic-target validation.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.ttdSupportedPanel}
              onToggle={() => toggleTableSection("ttdSupportedPanel")}
              label="TTD-supported results"
            />
            {!collapsedTables.ttdSupportedPanel ? (
            <>
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
            <HomeTableToggle
              collapsed={collapsedTables.ttdSupported}
              onToggle={() => toggleTableSection("ttdSupported")}
              label="TTD-supported result tables"
            />
            {!collapsedTables.ttdSupported ? (
            <div className="home-result-two-col">
              <div className="result-table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>TTD-supported consensus case</th>
                      <th>Disease</th>
                      <th>TTD support</th>
                      <th>MOA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ttdSupportedConsensusCases.length ? ttdSupportedConsensusCases.map((row) => (
                      <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                        <td>
                          <button className="result-link-btn" onClick={() => onAnalyze(row.drug_id)}>
                            <span className="result-emphasis-label">{row.drug_label}</span>
                          </button>
                        </td>
                        <td>{row.disease_label}</td>
                        <td><span className="result-emphasis-chip is-soft">{row.ttd_support_label}</span></td>
                        <td>{row.ttd_moa || "-"}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>No consensus rows are currently cross-supported by TTD in this release.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="result-table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>TTD-supported approved row</th>
                      <th>Disease</th>
                      <th>TTD support</th>
                      <th>MOA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ttdSupportedApprovedRows.length ? ttdSupportedApprovedRows.map((row) => (
                      <tr key={`${row.drug_id}-${row.target_id}-${row.disease_id}`}>
                        <td>
                          <button className="result-link-btn" onClick={() => onAnalyze(row.drug_id)}>
                            <span className="result-emphasis-label">{row.drug_label}</span>
                          </button>
                        </td>
                        <td>{row.disease_label}</td>
                        <td><span className="result-emphasis-chip is-soft">{row.ttd_support_label}</span></td>
                        <td>{row.ttd_moa || "-"}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>No approved rows are currently cross-supported by TTD in this release.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}
            </>
            ) : null}
          </section>
        ) : null}

        {targetCentricOverview ? (
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Therapeutic Target Module</h3>
              <div className="home-panel-subtitle">Target-centered released-network browsing.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.targetModulePanel}
              onToggle={() => toggleTableSection("targetModulePanel")}
              label="target module"
            />
            {!collapsedTables.targetModulePanel ? (
            <>
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
            <HomeTableToggle
              collapsed={collapsedTables.targetModule}
              onToggle={() => toggleTableSection("targetModule")}
              label="therapeutic target tables"
            />
            {!collapsedTables.targetModule ? (
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
                      <td><button className="result-link-btn" onClick={() => onAnalyze(row.target_id)}><span className="result-emphasis-label">{row.target_label}</span></button></td>
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
            ) : null}
            </>
            ) : null}
          </section>
        ) : null}

        {diseaseCentricOverview ? (
          <section className="home-panel-card home-panel-wide">
            <div className="home-panel-head">
              <h3>Disease Context Module</h3>
              <div className="home-panel-subtitle">Disease-centered released-network browsing.</div>
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.diseaseModulePanel}
              onToggle={() => toggleTableSection("diseaseModulePanel")}
              label="disease module"
            />
            {!collapsedTables.diseaseModulePanel ? (
            <>
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
            <HomeTableToggle
              collapsed={collapsedTables.diseaseModule}
              onToggle={() => toggleTableSection("diseaseModule")}
              label="disease context tables"
            />
            {!collapsedTables.diseaseModule ? (
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
                      <td><button className="result-link-btn" onClick={() => onAnalyze(row.disease_id)}><span className="result-emphasis-label">{row.disease_label}</span></button></td>
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
            ) : null}
            </>
            ) : null}
          </section>
        ) : null}

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Model-Stratified Result Overview</h3>
            <div className="home-panel-subtitle">Released rows grouped by method support.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.modelSummaryPanel}
            onToggle={() => toggleTableSection("modelSummaryPanel")}
            label="model summary"
          />
          {!collapsedTables.modelSummaryPanel ? (
          <>
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
          <HomeTableToggle
            collapsed={collapsedTables.modelOverview}
            onToggle={() => toggleTableSection("modelOverview")}
            label="model-stratified tables"
          />
          {!collapsedTables.modelOverview ? (
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
          ) : null}
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Seven-Model Support Overview</h3>
            <div className="home-panel-subtitle">Released rows grouped by seven-model support.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.voteOverviewPanel}
            onToggle={() => toggleTableSection("voteOverviewPanel")}
            label="seven-model support"
          />
          {!collapsedTables.voteOverviewPanel ? (
          <>
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
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Seven-Model DTI Consistency</h3>
            <div className="home-panel-subtitle">Coverage and co-support across the seven DTI models.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.dtiConsistencyPanel}
            onToggle={() => toggleTableSection("dtiConsistencyPanel")}
            label="seven-model consistency"
          />
          {!collapsedTables.dtiConsistencyPanel ? (
          <>
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
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Released-Method vs DTI-Model Consistency</h3>
            <div className="home-panel-subtitle">Released-method support compared with seven-model DTI support.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.methodConsistencyPanel}
            onToggle={() => toggleTableSection("methodConsistencyPanel")}
            label="method consistency"
          />
          {!collapsedTables.methodConsistencyPanel ? (
          <>
          <div className="home-result-two-col">
            <div className="dti-heatmap-card">
              <div className="dti-heatmap-head">
                <strong>Released-method consistency</strong>
                <span>The three released methods define the disease-level interpretation tier retained in the disease network atlas.</span>
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
                <span>The upstream DTI layer shows which of the seven models most frequently agree before disease network release filtering.</span>
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
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Seven-Model DTI Screening Map</h3>
            <div className="home-panel-subtitle">How seven-model DTI support feeds the released disease network.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.screeningMapPanel}
            onToggle={() => toggleTableSection("screeningMapPanel")}
            label="screening map"
          />
          {!collapsedTables.screeningMapPanel ? (
          <>
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
                <span>The disease network atlas currently exposes this layer through `7-model votes`, `Retained methods`, and per-record supporting-model panels.</span>
              </div>
              <div className="schema-note">
                <strong>Released interpretation layer</strong>
                <span>TXGNN, ENR, and RWR remain the explicit disease-level interpretation modules linked to the final released network.</span>
              </div>
            </div>
          </div>
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Disease Network Result Summary</h3>
            <div className="home-panel-subtitle">A compact overview of the released disease network.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.resultSummaryPanel}
            onToggle={() => toggleTableSection("resultSummaryPanel")}
            label="result summary"
          />
          {!collapsedTables.resultSummaryPanel ? (
          <>
          <div className="atlas-summary-figure">
            <svg viewBox="0 0 1160 320" role="img" aria-label="Disease network result summary figure">
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
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide">
          <div className="home-panel-head">
            <h3>Result Table Access</h3>
            <div className="home-panel-subtitle">Direct entry points to the main result tables.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.resultAccessPanel}
            onToggle={() => toggleTableSection("resultAccessPanel")}
            label="table access"
          />
          {!collapsedTables.resultAccessPanel ? (
          <>
          {ncrnaOverview ? (
            <div className="layer-legend-strip">
              <span className="layer-legend-pill is-release-layer">
                <strong>Prediction result access</strong>
                <em>Released disease-network result tables</em>
              </span>
              <span className="layer-legend-pill is-known-only">
                <strong>Disease context access</strong>
                <em>Curated disease-linked evidence tables</em>
              </span>
              <span className="layer-legend-pill is-cross-layer">
                <strong>Shared table workflow</strong>
                <em>Compare released rows and disease-context evidence from the same database entry area</em>
              </span>
            </div>
          ) : null}
          <div className="quick-access-grid">
            <button className="quick-access-card" onClick={() => onOpenDatabase?.("predictions")}>
              <strong>Prediction Result Table</strong>
              <span>View the released prediction table with sortable columns, model evidence, and per-record detail.</span>
            </button>
            {ncrnaOverview ? (
              <button className="quick-access-card quick-access-card--ncrna" onClick={() => onOpenDatabase?.("ncrna")}>
                <strong>Disease-Context Evidence Tables</strong>
                <span>Open the curated evidence summaries, disease-context distributions, and cross-layer relationship tables in the database view.</span>
              </button>
            ) : null}
            <button className="quick-access-card" onClick={() => onOpenDatabase?.("algorithms")}>
              <strong>Algorithm Distribution</strong>
              <span>View retained-method distribution, vote layers, and algorithm support summary in the database tables.</span>
            </button>
            <button className="quick-access-card" onClick={() => onOpenDatabase?.("nodes")}>
              <strong>Node and Edge Tables</strong>
              <span>Review released node and relationship tables before drilling down into network-level analysis.</span>
            </button>
          </div>
          </>
          ) : null}
        </section>

        <section className="home-panel-card home-panel-wide home-schema-card">
          <div className="home-panel-head">
            <h3>Disease Network Construction Schema</h3>
            <div className="home-panel-subtitle">Workflow from source tables to formal network release.</div>
          </div>
          <HomeTableToggle
            collapsed={collapsedTables.constructionPanel}
            onToggle={() => toggleTableSection("constructionPanel")}
            label="construction schema"
          />
          {!collapsedTables.constructionPanel ? (
          <>
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
            <svg className="home-schema-svg" viewBox="0 0 1180 250" role="img" aria-label="Disease network atlas construction schema">
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
              <text x="976" y="65" className="schema-title">4. Network Release</text>
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
                <span>Formal tables are exposed through the disease network atlas, database tables, and current-network result tables.</span>
              </div>
            </div>
          </div>
          </>
          ) : null}
        </section>

        <div className="home-research-grid">
          <section className="home-panel-card home-pipeline-card">
            <div className="home-panel-head">
              <h3>Data Integration Workflow</h3>
              {!collapsedTables.workflowPanel ? <div className="home-panel-subtitle">Primary data sources, algorithm screening, and final atlas output</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.workflowPanel}
              onToggle={() => toggleTableSection("workflowPanel")}
              label="data integration workflow"
            />
            {!collapsedTables.workflowPanel ? (
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
                    <strong>Network Output</strong>
                    <span>{nodeMap.Drug || 0} drug nodes</span>
                    <span>{nodeMap.Target || 0} target nodes</span>
                    <span>{nodeMap.Disease || 0} disease nodes</span>
                    <span>{edgeTotal} formal network edges</span>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Algorithm Result Summary</h3>
              {!collapsedTables.algoSummaryPanel ? <div className="home-panel-subtitle">Prediction-support composition retained in the current release</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.algoSummaryPanel}
              onToggle={() => toggleTableSection("algoSummaryPanel")}
              label="algorithm result summary"
            />
            {!collapsedTables.algoSummaryPanel ? (
              predictionSummary ? (
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
              ) : <div className="empty-state">Release-level research summary is not available.</div>
            ) : null}
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Method-to-Result Matrix</h3>
            {!collapsedTables.methodMatrixPanel ? <div className="home-panel-subtitle">Primary algorithm outputs surfaced in the database tables and released result views.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.methodMatrixPanel}
              onToggle={() => toggleTableSection("methodMatrixPanel")}
              label="method-to-result matrix"
            />
            {!collapsedTables.methodMatrixPanel ? (
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
            ) : null}
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
            <h3>Source Dataset Table</h3>
            {!collapsedTables.sourceDatasetPanel ? <div className="home-panel-subtitle">Rows incorporated from major source datasets in the current release.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.sourceDatasetPanel}
              onToggle={() => toggleTableSection("sourceDatasetPanel")}
              label="source dataset table"
            />
            {!collapsedTables.sourceDatasetPanel ? (
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
            ) : null}
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Formal Result Tables</h3>
              {!collapsedTables.formalTablesPanel ? <div className="home-panel-subtitle">Current release tables available for browsing and export</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.formalTablesPanel}
              onToggle={() => toggleTableSection("formalTablesPanel")}
              label="formal result tables"
            />
            {!collapsedTables.formalTablesPanel ? (
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
            ) : null}
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Approved Drug Validation</h3>
              {!collapsedTables.approvedValidationPanel ? <div className="home-panel-subtitle">External validation summary extracted from the formal report, showing coverage, retention, and score separation between approved and non-approved drugs.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.approvedValidationPanel}
              onToggle={() => toggleTableSection("approvedValidationPanel")}
              label="approved drug validation"
            />
            {!collapsedTables.approvedValidationPanel ? (
            approvedValidation ? (
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
            )) : null}
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Disease Distribution Summary</h3>
              {!collapsedTables.diseaseDistributionPanel ? <div className="home-panel-subtitle">Top disease nodes ranked by retained Drug-Disease and Target-Disease connectivity in the released disease network.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.diseaseDistributionPanel}
              onToggle={() => toggleTableSection("diseaseDistributionPanel")}
              label="disease distribution summary"
            />
            {!collapsedTables.diseaseDistributionPanel ? (
              <>
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
              </>
            ) : null}
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Selected Clinical Drug Results</h3>
              {!collapsedTables.selectedClinicalPanel ? <div className="home-panel-subtitle">Retained clinical drugs highlighted in the report, shown with their leading disease association in the current high-confidence result table.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.selectedClinicalPanel}
              onToggle={() => toggleTableSection("selectedClinicalPanel")}
              label="selected clinical drug results"
            />
            {!collapsedTables.selectedClinicalPanel ? (
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
                        <td>{item.disease_label || "Retained in network release"}</td>
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
            ) : null}
          </section>

        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Pipeline Shrinkage Summary</h3>
              {!collapsedTables.pipelineShrinkagePanel ? <div className="home-panel-subtitle">Scale reduction from raw DTI candidates to the released disease network and retained prediction rows.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.pipelineShrinkagePanel}
              onToggle={() => toggleTableSection("pipelineShrinkagePanel")}
              label="pipeline shrinkage summary"
            />
            {!collapsedTables.pipelineShrinkagePanel ? (
              <>
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
                      <tr><td>Release-filtered DTI pairs</td><td><span className="result-emphasis-number">{pipelineShrinkage.release_filtered_pairs || pipelineShrinkage.vote4_retained}</span></td></tr>
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
            {releasedDtiAudit?.release_filtered_pairs ? (
              <>
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
                <div className="network-caption">{releasedDtiAudit.coverage_note}</div>
              </>
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
                    <strong>{releasedDiseaseSummary.released_unique_diseases.toLocaleString()}</strong>
                    <em>Diseases represented</em>
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
                        </tr>
                      </thead>
                      <tbody>
                        {(releasedDiseaseSummary.top_rows || []).length ? releasedDiseaseSummary.top_rows.slice(0, 8).map((item) => (
                          <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}`}>
                            <td><button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                            <td><button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>{item.target_label}</button></td>
                            <td>{item.disease_label}</td>
                            <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4}>No released disease-linked rows are available.</td></tr>
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
                        </tr>
                      </thead>
                      <tbody>
                        {(releasedDiseaseSummary.top_targets || []).length ? releasedDiseaseSummary.top_targets.slice(0, 8).map((item) => (
                          <tr key={item.target_id}>
                            <td><button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}><span className="result-emphasis-label">{item.gene_name || item.target_label}</span></button></td>
                            <td><span className="result-emphasis-number">{item.row_count}</span></td>
                          </tr>
                        )) : (
                          <tr><td colSpan={2}>No target summary is available for the current released layer.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="network-caption">{releasedDiseaseSummary.coverage_note}</div>
              </>
            ) : null}
              </>
            ) : null}
          </section>

          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Detailed Result Tables</h3>
              {!collapsedTables.resultSummaryPanel ? <div className="home-panel-subtitle">Expanded release tables for consensus, disease, drug, target, and support distributions.</div> : null}
            </div>
            <HomeTableToggle
              collapsed={collapsedTables.resultSummaryPanel}
              onToggle={() => toggleTableSection("resultSummaryPanel")}
              label="detailed result tables"
            />
          </section>
        </div>

        {!collapsedTables.resultSummaryPanel ? (
          <>
        <div className="home-research-grid">
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
                    <th>TTD support</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {highConsensusCases.length ? highConsensusCases.map((item, idx) => {
                    const ttd = ttdSupportedConsensusMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`];
                    return (
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
                      <td>{ttd ? <span className="result-emphasis-chip is-soft">{ttd.ttd_support_label}</span> : "-"}</td>
                      <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                      <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                    </tr>
                  )}) : (
                    <tr><td colSpan={7}>No high-consensus results are available for the current release.</td></tr>
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
                    <th>ncRNA-supported drug</th>
                    <th>Best support</th>
                    <th>Best votes</th>
                  </tr>
                </thead>
                <tbody>
                  {diseaseSpotlights.length ? diseaseSpotlights.map((item) => {
                    const linked = ncrnaLinkedDrugMap[item.top_drug_id];
                    return (
                    <tr key={item.disease_id}>
                      <td>
                        <button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>
                          <span className="result-emphasis-label">{item.disease_label}</span>
                        </button>
                      </td>
                      <td><span className="result-emphasis-number">{item.row_count}</span></td>
                      <td>{item.top_drug_label || "-"}</td>
                      <td>{item.top_target_label || "-"}</td>
                      <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3</span></td>
                      <td><span className="result-emphasis-chip is-soft">{item.max_votes}/7</span></td>
                    </tr>
                  )}) : (
                    <tr><td colSpan={7}>No disease summary rows are available in the current release.</td></tr>
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
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
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
                    <th>Cross-associated diseases</th>
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
                      <td><span className="result-muted-multiline">{item.disease_summary || item.top_disease_label || "-"}</span></td>
                      <td>{item.top_drug_label || "-"}</td>
                      <td><span className="result-emphasis-chip">{item.max_algo_pass}/3 · {item.max_votes}/7</span></td>
                    </tr>
                  )) : <tr><td colSpan={6}>No target summary rows are available in the current release.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="home-research-grid">
          <section className="home-panel-card">
            <div className="home-panel-head">
              <h3>Drug Result Distribution</h3>
              <div className="home-panel-subtitle">Top retained drugs ranked by the number of released prediction rows in the current disease network release.</div>
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
              <div className="home-panel-subtitle">Top retained targets ranked by the number of released prediction rows in the current disease network release.</div>
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
                    <th>ncRNA-supported</th>
                    <th>TTD-supported</th>
                    <th>Top TXGNN</th>
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
                        <button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}>
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
                    <th>ncRNA-supported</th>
                    <th>TXGNN score</th>
                    <th>ENR FDR</th>
                  </tr>
                </thead>
                <tbody>
                  {topApprovedLeaderboard.length ? topApprovedLeaderboard.map((item, idx) => {
                    const linked = ncrnaLinkedApprovedMap[`${item.drug_id}|${item.target_id}|${item.disease_id}`] || ncrnaLinkedDrugMap[item.drug_id];
                    return (
                    <tr key={`${item.drug_id}-${item.target_id}-${item.disease_id}-${idx}`}>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.drug_id)}><span className="result-emphasis-label">{item.drug_label}</span></button></td>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.target_id)}>{item.target_label}</button></td>
                      <td><button className="result-link-btn" onClick={() => onAnalyze(item.disease_id)}>{item.disease_label}</button></td>
                      <td><span className="result-emphasis-chip">{item.n_algo_pass}/3 · {item.Total_Votes_Optional7}/7</span></td>
                      <td>{linked ? <span className="result-emphasis-chip is-soft">{linked.top_ncrna_name || "linked"} · {linked.linked_ncrna_count || 0}</span> : "-"}</td>
                      <td><span className="result-emphasis-number">{item.TXGNN_score ?? "-"}</span></td>
                      <td>{item.ENR_FDR != null ? <span className="result-emphasis-chip is-soft">{item.ENR_FDR}</span> : "-"}</td>
                    </tr>
                  )}) : <tr><td colSpan={7}>No approved priority rows are available in the current release.</td></tr>}
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
            </>
          ) : null}
      </div>
    </section>
  );
}
