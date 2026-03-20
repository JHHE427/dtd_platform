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
      body: "Integrated presentation of validated associations and model-supported relationships within a unified atlas."
    },
    {
      title: "Interactive Graph",
      body: "Support for graph navigation, local expansion, node inspection, and subnetwork comparison in an interactive network view."
    },
    {
      title: "Multi-Modal Detail",
      body: "Unified display of chemical structures, SMILES, target sequences, ontology terms, summaries, and evidence context."
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
          Browse known and predicted associations within the integrated Drug-Target-Disease
          heterogeneous network.
        </p>
        <div className="hero-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAnalyze(keyword)}
            placeholder="Search by DrugBank ID, target ID, disease name, or alias..."
          />
          <button onClick={() => onAnalyze(keyword)}>Open Analysis</button>
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
