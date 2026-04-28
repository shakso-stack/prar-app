import { useState, useEffect } from "react";

const STATUS_COLORS = {
  pending:  { bg: "#FFF9C4", border: "#F9A825", text: "#795400" },
  approved: { bg: "#C8E6C9", border: "#388E3C", text: "#1B5E20" },
  excluded: { bg: "#FFCDD2", border: "#D32F2F", text: "#B71C1C" },
};

export default function Stage2({ job, updateJob, goToStage }) {
  const [articles, setArticles] = useState(job.articles || []);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    updateJob({ articles });
  }, [articles]);

  function setStatus(idx, status) {
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, status } : a));
  }

  function updateField(idx, field, value) {
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  function deleteArticle(idx) {
    setArticles(prev => prev.filter((_, i) => i !== idx));
  }

  function addArticle() {
    setArticles(prev => [...prev, {
      author: "", title: "", journal: "", volume: "", issue: "",
      year: "", tier: "", abstract: "", link: "", part: "", status: "pending"
    }]);
  }

  function approveAll() {
    setArticles(prev => prev.map(a => ({ ...a, status: "approved" })));
  }

  const filtered = articles.map((a, i) => ({ ...a, _idx: i }))
    .filter(a => filter === "all" || a.status === filter);

  const counts = {
    all: articles.length,
    pending: articles.filter(a => !a.status || a.status === "pending").length,
    approved: articles.filter(a => a.status === "approved").length,
    excluded: articles.filter(a => a.status === "excluded").length,
  };

  function handleProceed() {
    const approved = articles.filter(a => a.status === "approved").map(a => {
      const { status, ...rest } = a;
      return rest;
    });
    updateJob({ articles: approved, stage: 3 });
    goToStage(3);
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={h2}>Stage 2 — Review Articles</h2>
          <p style={{ color: "#7a6a5a", fontSize: 14, margin: 0 }}>
            Approve or exclude each article. Only approved articles will proceed to compilation.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={addArticle} style={btnOutline}>+ Add Article</button>
          <button onClick={approveAll} style={btnOutline}>Approve All</button>
          <button
            onClick={handleProceed}
            disabled={counts.approved === 0}
            style={{ ...btnPrimary, opacity: counts.approved === 0 ? 0.4 : 1 }}
          >
            Proceed to Compile ({counts.approved} approved) →
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["all", "pending", "approved", "excluded"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "5px 16px", borderRadius: 20, fontFamily: "Crimson Text, serif",
            fontSize: 13, cursor: "pointer", border: "1px solid",
            borderColor: filter === s ? "#2c1810" : "#d0c8b8",
            background: filter === s ? "#2c1810" : "#fff",
            color: filter === s ? "#d4af7a" : "#666",
          }}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e0d6c8", borderRadius: 8, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ background: "#2c1810" }}>
              {["#", "Status", "Title / Author", "Journal", "Vol", "Issue", "Year", "Actions"].map(h => (
                <th key={h} style={{ ...thStyle, width: h === "Title / Author" ? 300 : h === "Journal" ? 200 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#aaa", fontFamily: "Crimson Text, serif" }}>
                No articles to show.
              </td></tr>
            )}
            {filtered.map((art) => {
              const idx = art._idx;
              const sc = STATUS_COLORS[art.status || "pending"];
              const isEditing = editingId === idx;
              const isExpanded = expanded === idx;
              return (
                <>
                  <tr key={idx} style={{ background: sc.bg + "55", borderBottom: "1px solid #e8e0d4" }}>
                    <td style={{ ...tdStyle, color: "#aaa", fontSize: 11, textAlign: "center", width: 36 }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, width: 100 }}>
                      <select
                        value={art.status || "pending"}
                        onChange={e => setStatus(idx, e.target.value)}
                        style={{
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                          borderRadius: 4, padding: "2px 6px", fontFamily: "Crimson Text, serif",
                          fontSize: 12, cursor: "pointer", width: "100%",
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 300 }}>
                      {isEditing ? (
                        <input value={art.title} onChange={e => updateField(idx, "title", e.target.value)}
                          style={cellInput} />
                      ) : (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, color: "#2c1810", lineHeight: 1.3 }}>{art.title || "—"}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{art.author || ""}</div>
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, width: 180, fontSize: 12 }}>
                      {isEditing ? <input value={art.journal} onChange={e => updateField(idx, "journal", e.target.value)} style={cellInput} />
                        : art.journal}
                    </td>
                    <td style={{ ...tdStyle, width: 50, fontSize: 12 }}>
                      {isEditing ? <input value={art.volume} onChange={e => updateField(idx, "volume", e.target.value)} style={cellInput} />
                        : art.volume}
                    </td>
                    <td style={{ ...tdStyle, width: 50, fontSize: 12 }}>
                      {isEditing ? <input value={art.issue} onChange={e => updateField(idx, "issue", e.target.value)} style={cellInput} />
                        : art.issue}
                    </td>
                    <td style={{ ...tdStyle, width: 55, fontSize: 12 }}>
                      {isEditing ? <input value={art.year} onChange={e => updateField(idx, "year", e.target.value)} style={cellInput} />
                        : art.year}
                    </td>
                    <td style={{ ...tdStyle, width: 120 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setExpanded(isExpanded ? null : idx)}
                          style={smallBtn("#4a90d9")}>
                          {isExpanded ? "▲" : "▼"}
                        </button>
                        <button onClick={() => setEditingId(isEditing ? null : idx)}
                          style={smallBtn(isEditing ? "#388e3c" : "#ff9800")}>
                          {isEditing ? "✓" : "Edit"}
                        </button>
                        <button onClick={() => deleteArticle(idx)}
                          style={smallBtn("#d32f2f")}>✕</button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${idx}-exp`} style={{ background: "#fffbf0", borderBottom: "1px solid #e8e0d4" }}>
                      <td colSpan={8} style={{ padding: "12px 20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>AUTHOR</div>
                            {isEditing
                              ? <input value={art.author} onChange={e => updateField(idx, "author", e.target.value)} style={{ ...cellInput, width: "100%" }} />
                              : <div style={{ fontSize: 13 }}>{art.author || "—"}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>LINK</div>
                            {isEditing
                              ? <input value={art.link} onChange={e => updateField(idx, "link", e.target.value)} style={{ ...cellInput, width: "100%" }} />
                              : <a href={art.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#4a90d9", wordBreak: "break-all" }}>{art.link || "—"}</a>}
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>ABSTRACT</div>
                            {isEditing
                              ? <textarea value={art.abstract} onChange={e => updateField(idx, "abstract", e.target.value)}
                                  style={{ ...cellInput, width: "100%", minHeight: 80, resize: "vertical" }} />
                              : <div style={{ fontSize: 13, lineHeight: 1.5, color: "#444" }}>{art.abstract || "Not available"}</div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, color: "#aaa", fontSize: 12 }}>
        {articles.length} total · {counts.approved} approved · {counts.excluded} excluded · {counts.pending} pending
      </div>
    </div>
  );
}

const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #4a2c1a" };
const tdStyle = { padding: "6px 8px", verticalAlign: "middle", borderRight: "1px solid #f0e8dc", fontFamily: "Crimson Text, serif" };
const cellInput = { border: "1px solid #d4af7a", borderRadius: 3, padding: "3px 6px", fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fffbf0" };
const smallBtn = (color) => ({ background: "none", border: `1px solid ${color}`, color, borderRadius: 3, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "Crimson Text, serif" });
