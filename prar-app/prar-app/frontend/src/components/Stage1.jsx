import { useState, useEffect } from "react";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// ─── Phase 1: Journal Template ───────────────────────────────────────────────

function Phase1({ rows, setRows, onFetchComplete }) {
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");

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

  const filled = rows.filter(r => (r.volume && r.volume.trim()) || (r.issue && r.issue.trim()));
  const filtered = rows.filter(r =>
    !filterText || r.journal.toLowerCase().includes(filterText.toLowerCase())
  );

  async function handleFetch() {
    const toFetch = rows.filter(r => r.issn && (r.volume || r.issue));
    if (toFetch.length === 0) {
      setError("Please fill in at least one Volume or Issue field before fetching.");
      return;
    }
    setError("");
    setFetching(true);
    setProgress({ done: 0, total: toFetch.length, current: "Starting..." });

    const results = [];
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
          const count = data.articles.length;
          allArticles = [...allArticles, ...data.articles];
          results.push({ ...entry, fetchStatus: count > 0 ? "ok" : "empty", count });
        } else {
          results.push({ ...entry, fetchStatus: "failed", count: 0 });
        }
      } catch (e) {
        results.push({ ...entry, fetchStatus: "failed", count: 0 });
      }
    }

    setProgress({ done: toFetch.length, total: toFetch.length, current: "Complete!" });
    setFetching(false);
    onFetchComplete(results, allArticles);
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
            Fill in the Volume and/or Issue, and Year columns for the journals you want to include, then click Fetch Articles.
            {filled.length > 0 && <span style={{ color: "#d4af7a", marginLeft: 8 }}>{filled.length} journal{filled.length !== 1 ? "s" : ""} ready to fetch.</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input placeholder="Filter journals..." value={filterText}
            onChange={e => setFilterText(e.target.value)} style={{ ...inputStyle, width: 200 }} />
          <button onClick={addRow} style={btnOutline}>+ Add Row</button>
          <button onClick={handleFetch} disabled={fetching || filled.length === 0} style={{
            ...btnPrimary, opacity: (fetching || filled.length === 0) ? 0.5 : 1,
          }}>
            {fetching ? "Fetching..." : "Fetch Articles"}
          </button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

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

      <div style={{ border: "1px solid #e0d6c8", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr style={{ background: "#2c1810" }}>
              <th style={{ ...thStyle, width: 36 }}>#</th>
              {COLS.map(c => <th key={c.key} style={{ ...thStyle, width: c.width }}>{c.label}</th>)}
              <th style={{ ...thStyle, width: 40 }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => {
              const highlight = (row.volume && row.volume.trim()) || (row.issue && row.issue.trim());
              return (
                <tr key={row.id} style={{
                  background: highlight ? "#eef4ee" : idx % 2 === 0 ? "#fff" : "#faf8f5",
                  borderBottom: "1px solid #e8e0d4",
                }}>
                  <td style={{ ...tdStyle, color: "#aaa", fontSize: 11, textAlign: "center" }}>{idx + 1}</td>
                  {COLS.map(c => (
                    <td key={c.key} style={tdStyle}>
                      <input value={row[c.key] || ""} onChange={e => updateCell(row.id, c.key, e.target.value)}
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
                      background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, padding: "2px 6px",
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
      </div>
      <div style={{ marginTop: 10, color: "#aaa", fontSize: 12 }}>
        {rows.length} journals · {filtered.length} shown · {filled.length} with volume filled
      </div>
    </div>
  );
}

// ─── Phase 2: Fetch Results Summary ──────────────────────────────────────────

function Phase2({ results, setResults, articles, setArticles, onBack, onProceed }) {
  const [retrying, setRetrying] = useState({});
  const [showAddRow, setShowAddRow] = useState(false);
  const [newEntry, setNewEntry] = useState({ tier: "", journal: "", issn: "", volume: "", issue: "", year: "" });
  const [addError, setAddError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const ok     = results.filter(r => r.fetchStatus === "ok").length;
  const empty  = results.filter(r => r.fetchStatus === "empty").length;
  const failed = results.filter(r => r.fetchStatus === "failed").length;

  async function retryOne(idx) {
    const entry = results[idx];
    setRetrying(r => ({ ...r, [idx]: true }));
    try {
      const resp = await fetch(`${BACKEND}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: [entry] }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = data.articles.length;
        setArticles(prev => {
          const without = prev.filter(a =>
            !(a.journal === entry.journal && a.volume === entry.volume && a.issue === entry.issue)
          );
          return [...without, ...data.articles];
        });
        setResults(prev => prev.map((r, i) =>
          i === idx ? { ...r, fetchStatus: count > 0 ? "ok" : "empty", count } : r
        ));
      } else {
        setResults(prev => prev.map((r, i) =>
          i === idx ? { ...r, fetchStatus: "failed" } : r
        ));
      }
    } catch {
      setResults(prev => prev.map((r, i) =>
        i === idx ? { ...r, fetchStatus: "failed" } : r
      ));
    }
    setRetrying(r => ({ ...r, [idx]: false }));
  }

  async function retryAllFailed() {
    const indices = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.fetchStatus === "failed" || r.fetchStatus === "empty")
      .map(({ i }) => i);
    for (const idx of indices) await retryOne(idx);
  }

  async function handleAddJournal() {
    if (!newEntry.journal.trim() || !newEntry.issn.trim() || !newEntry.volume.trim()) {
      setAddError("Journal, ISSN, and Volume are required.");
      return;
    }
    setAddError("");
    setRetrying(r => ({ ...r, new: true }));
    try {
      const resp = await fetch(`${BACKEND}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: [newEntry] }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = data.articles.length;
        setArticles(prev => [...prev, ...data.articles]);
        setResults(prev => [...prev, { ...newEntry, fetchStatus: count > 0 ? "ok" : "empty", count }]);
      } else {
        setResults(prev => [...prev, { ...newEntry, fetchStatus: "failed", count: 0 }]);
      }
      setNewEntry({ tier: "", journal: "", issn: "", volume: "", issue: "", year: "" });
      setShowAddRow(false);
    } catch {
      setAddError("Network error. Please try again.");
    }
    setRetrying(r => ({ ...r, new: false }));
  }

  const filtered = results
    .map((r, i) => ({ ...r, _idx: i }))
    .filter(r => filterStatus === "all" || r.fetchStatus === filterStatus);

  const statusStyle = {
    ok:     { bg: "#e8f5e9", border: "#4caf50", text: "#1b5e20", label: "✓ OK" },
    empty:  { bg: "#fff8e1", border: "#ffc107", text: "#795400", label: "⚠ Empty" },
    failed: { bg: "#ffebee", border: "#f44336", text: "#b71c1c", label: "✕ Failed" },
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={h2}>Stage 1 — Fetch Results</h2>
          <p style={{ color: "#7a6a5a", fontSize: 14, margin: 0 }}>
            Review what was fetched. Retry failed or empty journals, or add a new one before proceeding.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onBack} style={btnOutline}>← Edit Journal List</button>
          {(failed > 0 || empty > 0) && (
            <button onClick={retryAllFailed} style={{ ...btnOutline, color: "#e65100", borderColor: "#e65100" }}>
              ↺ Retry All Failed/Empty ({failed + empty})
            </button>
          )}
          <button onClick={() => setShowAddRow(s => !s)} style={btnOutline}>+ Add Journal</button>
          <button onClick={() => onProceed(articles)} style={btnPrimary}>
            Proceed to Review ({articles.length} articles) →
          </button>
        </div>
      </div>

      {/* Summary filter chips */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
        {[
          { key: "all",    label: `All (${results.length})`,  bg: "#f5f5f5", border: "#ccc",     text: "#333" },
          { key: "ok",     label: `✓ OK (${ok})`,             ...statusStyle.ok },
          { key: "empty",  label: `⚠ Empty (${empty})`,       ...statusStyle.empty },
          { key: "failed", label: `✕ Failed (${failed})`,     ...statusStyle.failed },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)} style={{
            padding: "5px 16px", borderRadius: 20, fontFamily: "Crimson Text, serif",
            fontSize: 13, cursor: "pointer",
            border: `1px solid ${filterStatus === s.key ? s.border : "#d0c8b8"}`,
            background: filterStatus === s.key ? s.bg : "#fff",
            color: filterStatus === s.key ? s.text : "#666",
            fontWeight: filterStatus === s.key ? 600 : 400,
          }}>{s.label}</button>
        ))}
        <div style={{ marginLeft: "auto", color: "#888", fontSize: 13 }}>
          {articles.length} articles fetched total
        </div>
      </div>

      {/* Add journal form */}
      {showAddRow && (
        <div style={{ background: "#fffbf0", border: "1px solid #d4af7a", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#2c1810", fontWeight: 600, marginBottom: 12 }}>
            Add a journal and fetch it now
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 130px 80px 80px 80px", gap: 10, marginBottom: 10 }}>
            {[
              { key: "tier",    label: "Tier" },
              { key: "journal", label: "Journal *" },
              { key: "issn",    label: "ISSN *" },
              { key: "volume",  label: "Volume *" },
              { key: "issue",   label: "Issue" },
              { key: "year",    label: "Year" },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{f.label}</div>
                <input value={newEntry[f.key]}
                  onChange={e => setNewEntry(n => ({ ...n, [f.key]: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", padding: "5px 8px" }} />
              </div>
            ))}
          </div>
          {addError && <div style={{ color: "#e53935", fontSize: 13, marginBottom: 8 }}>{addError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAddJournal} disabled={retrying.new}
              style={{ ...btnPrimary, opacity: retrying.new ? 0.6 : 1 }}>
              {retrying.new ? "Fetching..." : "Fetch & Add"}
            </button>
            <button onClick={() => { setShowAddRow(false); setAddError(""); }} style={btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Results table */}
      <div style={{ border: "1px solid #e0d6c8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ background: "#2c1810" }}>
              {["#", "Journal", "ISSN", "Vol", "Issue", "Year", "Status", "Articles", "Action"].map(h => (
                <th key={h} style={{ ...thStyle, width: h === "Journal" ? 240 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "#aaa", fontFamily: "Crimson Text, serif" }}>
                No results to show for this filter.
              </td></tr>
            )}
            {filtered.map(({ _idx, ...row }) => {
              const ss = statusStyle[row.fetchStatus] || statusStyle.failed;
              const isRetrying = retrying[_idx];
              return (
                <tr key={_idx} style={{ background: ss.bg + "44", borderBottom: "1px solid #eee" }}>
                  <td style={{ ...tdStyle, color: "#aaa", fontSize: 11, textAlign: "center", width: 36 }}>{_idx + 1}</td>
                  <td style={{ ...tdStyle, fontStyle: "italic", fontSize: 13 }}>{row.journal}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "#888" }}>{row.issn}</td>
                  <td style={{ ...tdStyle, fontSize: 13, fontWeight: 600, color: "#2c6e49" }}>{row.volume}</td>
                  <td style={{ ...tdStyle, fontSize: 13, color: "#2c6e49" }}>{row.issue}</td>
                  <td style={{ ...tdStyle, fontSize: 13, color: "#2c6e49" }}>{row.year}</td>
                  <td style={{ ...tdStyle }}>
                    <span style={{
                      background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`,
                      borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                    }}>{ss.label}</span>
                  </td>
                  <td style={{
                    ...tdStyle, textAlign: "center", fontSize: 13,
                    fontWeight: row.count > 0 ? 600 : 400,
                    color: row.count > 0 ? "#1b5e20" : "#aaa",
                  }}>
                    {row.count ?? "—"}
                  </td>
                  <td style={{ ...tdStyle }}>
                    {(row.fetchStatus === "failed" || row.fetchStatus === "empty") && (
                      <button onClick={() => retryOne(_idx)} disabled={isRetrying} style={{
                        background: "none", border: `1px solid ${ss.border}`, color: ss.text,
                        borderRadius: 4, padding: "2px 10px", fontSize: 12, cursor: "pointer",
                        fontFamily: "Crimson Text, serif", opacity: isRetrying ? 0.5 : 1,
                      }}>
                        {isRetrying ? "..." : "↺ Retry"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, color: "#aaa", fontSize: 12 }}>
        {results.length} journals fetched · {ok} OK · {empty} empty · {failed} failed
      </div>
    </div>
  );
}

// ─── Main Stage 1 Orchestrator ────────────────────────────────────────────────

export default function Stage1({ job, updateJob, goToStage }) {
  const [rows, setRows] = useState(() => {
    if (job.journalIssues && job.journalIssues.length > 0) return job.journalIssues;
    return [];
  });
  const [fetchResults, setFetchResults] = useState(() => job.fetchResults || null);
  const [articles, setArticles] = useState(() => job.articles || []);

  useEffect(() => { updateJob({ journalIssues: rows }); }, [rows]);
  useEffect(() => { updateJob({ fetchResults, articles }); }, [fetchResults, articles]);

  function handleFetchComplete(results, allArticles) {
    setFetchResults(results);
    setArticles(allArticles);
  }

  function handleProceed(finalArticles) {
    updateJob({ articles: finalArticles, stage: 2 });
    goToStage(2);
  }

  if (fetchResults) {
    return (
      <Phase2
        results={fetchResults}
        setResults={setFetchResults}
        articles={articles}
        setArticles={setArticles}
        onBack={() => setFetchResults(null)}
        onProceed={handleProceed}
      />
    );
  }

  return <Phase1 rows={rows} setRows={setRows} onFetchComplete={handleFetchComplete} />;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const inputStyle = { padding: "6px 12px", border: "1px solid #d0c8b8", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fff" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #4a2c1a", background: "#2c1810" };
const tdStyle = { padding: "6px 8px", verticalAlign: "middle", borderRight: "1px solid #f0e8dc", fontFamily: "Crimson Text, serif" };
const errorBox = { background: "#ff7c7c22", border: "1px solid #ff7c7c", borderRadius: 6, padding: "10px 16px", color: "#ff7c7c", marginBottom: 16, fontSize: 14 };
