import React from "react";

export default function HomePage({ stats, onAnalyze }) {
  const [keyword, setKeyword] = React.useState("");
  const nodeMap = React.useMemo(
    () => Object.fromEntries((stats?.node_by_type || []).map((x) => [x.node_type, x.count])),
    [stats]
  );
  const edgeTotal = React.useMemo(
    () => (stats?.edge_by_type || []).reduce((sum, x) => sum + x.count, 0),
    [stats]
  );
  const featureCards = [
    {
      title: "Known + Predicted",
      body: "Unified browsing of validated links and model-supported associations in one atlas."
    },
    {
      title: "Interactive Graph",
      body: "Zoom, pan, expand, inspect, and compare subnetworks in a publication-grade network view."
    },
    {
      title: "Multi-Modal Detail",
      body: "Surface structures, SMILES, sequences, ontology, summaries, and evidence context together."
    }
  ];

  return (
    <section className="page is-active home-page">
      <div className="hero">
        <div className="hero-pill">Production Release · React Edition</div>
        <h1>
          Disease-Target-Drug
          <span>Interaction Atlas</span>
        </h1>
        <p>
          Explore known and predicted links in the unified DTD heterogeneous network built from
          your curated database pipeline.
        </p>
        <div className="hero-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAnalyze(keyword)}
            placeholder="Search by DB ID / BE ID / disease name..."
          />
          <button onClick={() => onAnalyze(keyword)}>Analyze</button>
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
      </div>
    </section>
  );
}
