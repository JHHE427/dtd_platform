import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, msg: err?.message || "Unknown render error" };
  }

  componentDidCatch() {
    // keep UI alive
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <div className="card panel-pad">
            <h3 style={{ marginTop: 0 }}>Analysis Render Failed</h3>
            <div className="item-meta">{this.state.msg}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
