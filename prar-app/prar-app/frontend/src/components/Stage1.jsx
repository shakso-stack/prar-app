import { useState, useEffect } from "react";
import { JOURNALS } from "../data";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Stage1({ job, updateJob, goToStage }) {
  const [rows, setRows] = useState(() => {
    if (job.journalIssues && job.journalIssues.length > 0) return job.journalIssues;
    return JOURNALS.map((j, i) => ({ id: i + 1, ...j, volume: "", issue: "", year: "" }));
  });
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    updateJob({ journalIssues: rows });
  }, [rows]);

  function updateCell(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow() {
    const newId = Math.max(0, ...rows.map(r => r.id)) + 1;
    setRows(prev => [...prev, { id: newId, tier: "", journal: "", issn: "", volume: "", issue: "", year: "" }]);
  }

  function deleteRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  const filled = rows.filter(r => r.volume && r.volume.trim());
  const filtered = rows.filter(r =>
    !filterText || r.journal.toLowerCase().includes(filterText.toLowerCase())
  );

  async function handleFetch() {
    const toFetch = rows.filter(r => r.issn && r.volume);
    if (toFetch.length === 0) {
      setError("Please fill in at least one Volume field before fetching.");
      return;
    }
    setError("");
    setFetching(true);
    setProgress({ done: 0, total: toFetch.length, current: "Starting..." });

    try {
      // Fetch one by one for progress updates
      let allArticles = [];
      for (let i = 0; i < toFetch.length; i++) {
        const entry = toFetch[i];
        setProgress({ done: i, total: toFetch.length, current: entry.journal });
        try {
          const resp = await fetch(`${BACKEND}/fetch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issues: [entry] }),
          });
          if (resp.ok) {
            const data = await resp.json();
            allArticles = [...allArticles, ...data.articles];
          }
        } catch (e) {
          console.warn(`Failed to fetch ${entry.journal}:`, e);
        }
      }
      setProgress({ done: toFetch.length, total: toFetch.length, current: "Complete!" });
      updateJob({ articles: allArticles, stage: 2 });
      setTimeout(() => goToStage(2), 600);
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setFetching(false);
    }
  }

  const COLS = [
    { key: "tier", label: "Tier", width: 55 },
    { key: "journal", label: "Journal", width: 280 },
    { key: "issn", label: "ISSN", width: 120 },
    { key: "volume", label: "Volume", width: 75 },
    { key: "issue", label: "Issue", width: 65 },
    { key: "year", label: "Year", width: 75 },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={h2}>Stage 1 — Fetch Articles</h2>
          <p style={{ color: "#7a6a5a", fontSize: 14, margin: 0 }}>
            Fill in the Volume and Issue columns for the journals you want to include, then click Fetch Articles.
            {filled.length > 0 && <span style={{ color: "#d4af7a", marginLeft: 8 }}>{filled.length} journal{filled.length !== 1 ? "s" : ""} ready to fetch.</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            placeholder="Filter journals..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
          <button onClick={addRow} style={btnOutline}>+ Add Row</button>
          <button onClick={handleFetch} disabled={fetching || filled.length === 0} style={{
            ...btnPrimary,
            opacity: (fetching || filled.length === 0) ? 0.5 : 1,
          }}>
            {fetching ? "Fetching..." : "Fetch Articles"}
          </button>
        </div>
      </div>

      {error && <div style={{ background: "#ff7c7c22", border: "1px solid #ff7c7c", borderRadius: 6, padding: "10px 16px", color: "#ff7c7c", marginBottom: 16, fontSize: 14 }}>{error}</div>}

      {fetching && (
        <div style={{ background: "#2c1810", border: "1px solid #d4af7a", borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ color: "#d4af7a", marginBottom: 10, fontSize: 14 }}>
            Fetching from Crossref... {progress.done}/{progress.total}
            {progress.current && <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: 8 }}>— {progress.current}</span>}
          </div>
          <div style={{ background: "#1a0f0a", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{
              background: "#d4af7a", height: "100%", borderRadius: 4,
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Spreadsheet */}
      <div style={{ overflowX: "auto", border: "1px solid #e0d6c8", borderRadius: 8, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
          <thead>
            <tr style={{ background: "#2c1810" }}>
              <th style={{ ...thStyle, width: 36 }}>#</th>
              {COLS.map(c => (
                <th key={c.key} style={{ ...thStyle, width: c.width }}>{c.label}</th>
              ))}
              <th style={{ ...thStyle, width: 40 }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => {
              const highlight = row.volume && row.volume.trim();
              return (
                <tr key={row.id} style={{
                  background: highlight ? "#fffbf0" : idx % 2 === 0 ? "#fff" : "#faf8f5",
                  borderBottom: "1px solid #e8e0d4",
                }}>
                  <td style={{ ...tdStyle, color: "#aaa", fontSize: 11, textAlign: "center" }}>{idx + 1}</td>
                  {COLS.map(c => (
                    <td key={c.key} style={tdStyle}>
                      <input
                        value={row[c.key] || ""}
                        onChange={e => updateCell(row.id, c.key, e.target.value)}
                        style={{
                          width: "100%", border: "none", background: "transparent",
                          fontFamily: "Crimson Text, serif", fontSize: 13,
                          color: c.key === "volume" || c.key === "issue" || c.key === "year" ? "#2c6e49" : "#333",
                          fontWeight: c.key === "volume" ? 600 : 400,
                          padding: "4px 6px", outline: "none",
                        }}
                        onFocus={e => e.target.style.background = "#fff8e8"}
                        onBlur={e => e.target.style.background = "transparent"}
                      />
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button onClick={() => deleteRow(row.id)} style={{
                      background: "none", border: "none", color: "#ccc",
                      cursor: "pointer", fontSize: 14, padding: "2px 6px",
                    }}
                      onMouseEnter={e => e.target.style.color = "#e53935"}
                      onMouseLeave={e => e.target.style.color = "#ccc"}
                    >✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, color: "#aaa", fontSize: 12 }}>
        {rows.length} journals · {filtered.length} shown · {filled.length} with volume filled
      </div>
    </div>
  );
}

const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const inputStyle = { padding: "6px 12px", border: "1px solid #d0c8b8", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fff" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #4a2c1a" };
const tdStyle = { padding: "2px 4px", verticalAlign: "middle", borderRight: "1px solid #f0e8dc" };
