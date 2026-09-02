import { useState } from "react";
import "./App.css";

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) {
      setError("Please enter a GitHub repo URL");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Something went wrong. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Extract overall score item separately
  const overall = result?.analysis?.find((item) => item.file === "OVERALL");
  const issues = result?.analysis?.filter((item) => item.file !== "OVERALL") || [];

  const severityColor = (severity) => {
    if (severity === "Critical") return "#e63946";
    if (severity === "Warning") return "#f4a261";
    if (severity === "Suggestion") return "#2a9d8f";
    return "#888";
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🛡️ CodeSentry AI</h1>
        <p>Instant AI-powered code reviews for any GitHub repo</p>
      </header>

      <div className="input-section">
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
        <button onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading-text">This can take 15-30 seconds...</p>}

      {result && (
        <div className="results">
          <h2>
            {result.owner}/{result.repo}
          </h2>

          {overall && (
            <div className="score-card">
              <h3>{overall.issue}</h3>
              <p>{overall.suggestion}</p>
            </div>
          )}

          <div className="issues-list">
            {issues.map((issue, i) => (
              <div key={i} className="issue-card">
                <div
                  className="severity-badge"
                  style={{ backgroundColor: severityColor(issue.severity) }}
                >
                  {issue.severity}
                </div>
                <div className="issue-content">
                  <p className="file-name">{issue.file}</p>
                  <p className="issue-desc">{issue.issue}</p>
                  <p className="suggestion">💡 {issue.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;