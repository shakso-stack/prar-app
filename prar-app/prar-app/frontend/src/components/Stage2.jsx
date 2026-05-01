import { useState, useEffect, useCallback } from "react";

const DEFAULT_KEYWORDS = [
  // 26 countries
  "Algeria","Bahrain","Comoros","Djibouti","Egypt","Iraq","Iran","Israel",
  "Jordan","Kuwait","Lebanon","Libya","Mauritania","Morocco","Oman",
  "Palestine","Qatar","Saudi Arabia","Somalia","Sudan","Syria","Tunisia",
  "Turkey","United Arab Emirates","Yemen",
  // Necessary demonyms
  "Turkish","Arab","Arabic","Kurdish","Kurdistan",
  // Regional terms
  "Gulf","GCC","Levant","Maghreb","MENA","Mesopotamia","Ottoman",
  "Saudi","UAE","North Africa","Middle East",
];

const STATUS_COLORS = {
  pending:       { bg: "#FFF9C4", border: "#F9A825", text: "#795400" },
  approved:      { bg: "#C8E6C9", border: "#388E3C", text: "#1B5E20" },
  "auto-approved": { bg: "#B3E5FC", border: "#0288D1", text: "#01579B" },
  excluded:      { bg: "#FFCDD2", border: "#D32F2F", text: "#B71C1C" },
};

function getMatches(article, keywords) {
  const haystack = [
    article.title || "",
    article.abstract || "",
    article.journal || "",
  ].join(" ").toLowerCase();
  return keywords.filter(kw => haystack.includes(kw.toLowerCase()));
}

function applyKeywords(articles, keywords) {
  return articles.map(a => {
    const matches = getMatches(a, keywords);
    const hasMatch = matches.length > 0;
    // Only auto-set status if currently pending or auto-approved (don't override manual decisions)
    let status = a.status;
    if (status === "pending" || status === "auto-approved" || !status) {
      status = hasMatch ? "auto-approved" : "pending";
    }
    return { ...a, keywordMatches: matches, status };
  });
}

export default function Stage2({ job, updateJob, goToStage }) {
  const [keywords, setKeywords] = useState(() => job.keywords || DEFAULT_KEYWORDS);
  const [articles, setArticles] = useState(() => {
    const arts = job.articles || [];
    return applyKeywords(arts, job.keywords || DEFAULT_KEYWORDS);
  });
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showKeywords, setShowKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  // Re-run keyword matching whenever keywords change
  useEffect(() => {
    setArticles(prev => applyKeywords(prev, keywords));
  }, [keywords]);

  useEffect(() => {
    updateJob({ articles, keywords });
  }, [articles, keywords]);

  function setStatus(idx, status) {
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, status } : a));
  }

  function updateField(idx, field, value) {
    setArticles(prev => {
      const next = prev.map((a, i) => {
        if (i !== idx) return a;
        const updated = { ...a, [field]: value };
        // Re-run matching if a searchable field changed
        if (["title", "abstract", "journal"].includes(field)) {
          updated.keywordMatches = getMatches(updated, keywords);
        }
        return updated;
      });
      return next;
    });
  }

  function deleteArticle(idx) {
    setArticles(prev => prev.filter((_, i) => i !== idx));
  }

  function addArticle() {
    setArticles(prev => [...prev, {
      author: "", title: "", journal: "", volume: "", issue: "",
      year: "", tier: "", abstract: "", link: "", part: "",
      status: "pending", keywordMatches: [],
    }]);
  }

  function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw || keywords.includes(kw)) return;
    setKeywords(prev => [...prev, kw]);
    setNewKeyword("");
  }

  function removeKeyword(kw) {
    setKeywords(prev => prev.filter(k => k !== kw));
  }

  function resetKeywords() {
    if (window.confirm("Reset to the default keyword list?")) {
      setKeywords(DEFAULT_KEYWORDS);
    }
  }

  const FILTER_OPTIONS = ["all", "pending", "auto-approved", "approved", "excluded"];

  const counts = {
    all: articles.length,
    pending: articles.filter(a => !a.status || a.status === "pending").length,
    "auto-approved": articles.filter(a => a.status === "auto-approved").length,
    approved: articles.filter(a => a.status === "approved").length,
    excluded: articles.filter(a => a.status === "excluded").length,
  };

  const filtered = articles
    .map((a, i) => ({ ...a, _idx: i }))
    .filter(a => filter === "all" || a.status === filter ||
      (filter === "pending" && !a.status));

  function handleProceed() {
    const approved = articles
      .filter(a => a.status === "approved" || a.status === "auto-approved")
      .map(({ status, keywordMatches, ...rest }) => rest);
    updateJob({ articles: approved, keywords, stage: 3 });
    goToStage(3);
  }

  const approvedCount = counts.approved + counts["auto-approved"];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={h2}>Stage 2 — Review Articles</h2>
          <p style={{ color: "#7a6a5a", fontSize: 14, margin: 0 }}>
            Articles matching your keywords are Auto-Approved. Review Pending articles manually before proceeding.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowKeywords(s => !s)} style={{
            ...btnOutline,
            borderColor: showKeywords ? "#0288D1" : "#2c1810",
            color: showKeywords ? "#0288D1" : "#2c1810",
          }}>
            {showKeywords ? "▲ Hide Keywords" : "▼ Keywords"} ({keywords.length})
          </button>
          <button onClick={addArticle} style={btnOutline}>+ Add Article</button>
          <button onClick={handleProceed} disabled={approvedCount === 0}
            style={{ ...btnPrimary, opacity: approvedCount === 0 ? 0.4 : 1 }}>
            Proceed to Compile ({approvedCount} approved) →
          </button>
        </div>
      </div>

      {/* Keyword panel */}
      {showKeywords && (
        <div style={{
          background: "#e8f4fd", border: "1px solid #90CAF9",
          borderRadius: 8, padding: "16px 20px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#01579B" }}>
              Keyword List — articles matching any of these in Title, Abstract, or Journal are Auto-Approved
            </div>
            <button onClick={resetKeywords} style={{ ...smallBtn("#01579B"), fontSize: 12, padding: "3px 10px" }}>
              Reset to Default
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {keywords.map(kw => (
              <span key={kw} style={{
                background: "#fff", border: "1px solid #90CAF9", borderRadius: 14,
                padding: "2px 10px", fontSize: 12, color: "#01579B",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} style={{
                  background: "none", border: "none", color: "#90CAF9",
                  cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1,
                }}
                  onMouseEnter={e => e.target.style.color = "#D32F2F"}
                  onMouseLeave={e => e.target.style.color = "#90CAF9"}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder="Add a keyword..."
              style={{ ...inputStyle, width: 220 }}
            />
            <button onClick={addKeyword} style={{ ...btnOutline, borderColor: "#0288D1", color: "#0288D1" }}>
              + Add
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTER_OPTIONS.map(s => {
          const sc = STATUS_COLORS[s];
          const isActive = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "5px 14px", borderRadius: 20, fontFamily: "Crimson Text, serif",
              fontSize: 13, cursor: "pointer", border: "1px solid",
              borderColor: isActive ? (sc?.border || "#2c1810") : "#d0c8b8",
              background: isActive ? (sc?.bg || "#2c1810") : "#fff",
              color: isActive ? (sc?.text || "#d4af7a") : "#666",
              fontWeight: isActive ? 600 : 400,
            }}>
              {s === "auto-approved" ? "Auto-Approved" : s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] || 0})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e0d6c8", borderRadius: 8, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ background: "#2c1810" }}>
              {["#", "Status", "Title / Author", "Journal", "Vol", "Issue", "Year", "Keywords", "Actions"].map(h => (
                <th key={h} style={{
                  ...thStyle,
                  width: h === "Title / Author" ? 260 : h === "Journal" ? 180 : h === "Keywords" ? 160 : undefined,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#aaa", fontFamily: "Crimson Text, serif" }}>
                No articles to show.
              </td></tr>
            )}
            {filtered.map((art) => {
              const idx = art._idx;
              const sc = STATUS_COLORS[art.status || "pending"];
              const isEditing = editingId === idx;
              const isExpanded = expanded === idx;
              const matches = art.keywordMatches || [];
              return (
                <>
                  <tr key={idx} style={{ background: sc.bg + "55", borderBottom: "1px solid #e8e0d4" }}>
                    <td style={{ ...tdStyle, color: "#aaa", fontSize: 11, textAlign: "center", width: 36 }}>{idx + 1}</td>

                    {/* Status */}
                    <td style={{ ...tdStyle, width: 110 }}>
                      <select value={art.status || "pending"} onChange={e => setStatus(idx, e.target.value)}
                        style={{
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                          borderRadius: 4, padding: "2px 4px", fontFamily: "Crimson Text, serif",
                          fontSize: 11, cursor: "pointer", width: "100%",
                        }}>
                        <option value="pending">Pending</option>
                        <option value="auto-approved">Auto-Approved</option>
                        <option value="approved">Approved</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </td>

                    {/* Title / Author */}
                    <td style={{ ...tdStyle, maxWidth: 260 }}>
                      {isEditing ? (
                        <input value={art.title} onChange={e => updateField(idx, "title", e.target.value)} style={cellInput} />
                      ) : (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, color: "#2c1810", lineHeight: 1.3 }}>{art.title || "—"}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{art.author || ""}</div>
                        </div>
                      )}
                    </td>

                    {/* Journal */}
                    <td style={{ ...tdStyle, width: 180, fontSize: 12 }}>
                      {isEditing
                        ? <input value={art.journal} onChange={e => updateField(idx, "journal", e.target.value)} style={cellInput} />
                        : art.journal}
                    </td>

                    {/* Vol */}
                    <td style={{ ...tdStyle, width: 50, fontSize: 12 }}>
                      {isEditing
                        ? <input value={art.volume} onChange={e => updateField(idx, "volume", e.target.value)} style={cellInput} />
                        : art.volume}
                    </td>

                    {/* Issue */}
                    <td style={{ ...tdStyle, width: 50, fontSize: 12 }}>
                      {isEditing
                        ? <input value={art.issue} onChange={e => updateField(idx, "issue", e.target.value)} style={cellInput} />
                        : art.issue}
                    </td>

                    {/* Year */}
                    <td style={{ ...tdStyle, width: 55, fontSize: 12 }}>
                      {isEditing
                        ? <input value={art.year} onChange={e => updateField(idx, "year", e.target.value)} style={cellInput} />
                        : art.year}
                    </td>

                    {/* Keyword matches */}
                    <td style={{ ...tdStyle, width: 160 }}>
                      {matches.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {matches.slice(0, 3).map(kw => (
                            <span key={kw} style={{
                              background: "#B3E5FC", color: "#01579B",
                              border: "1px solid #81D4FA", borderRadius: 10,
                              padding: "1px 7px", fontSize: 10, whiteSpace: "nowrap",
                            }}>{kw}</span>
                          ))}
                          {matches.length > 3 && (
                            <span style={{ fontSize: 10, color: "#0288D1", alignSelf: "center" }}>
                              +{matches.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          background: "#FFF9C4", color: "#795400",
                          border: "1px solid #F9A825", borderRadius: 10,
                          padding: "1px 8px", fontSize: 10,
                        }}>⚠ No match</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, width: 110 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setExpanded(isExpanded ? null : idx)} style={smallBtn("#4a90d9")}>
                          {isExpanded ? "▲" : "▼"}
                        </button>
                        <button onClick={() => setEditingId(isEditing ? null : idx)}
                          style={smallBtn(isEditing ? "#388e3c" : "#ff9800")}>
                          {isEditing ? "✓" : "Edit"}
                        </button>
                        <button onClick={() => deleteArticle(idx)} style={smallBtn("#d32f2f")}>✕</button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${idx}-exp`} style={{ background: "#fffbf0", borderBottom: "1px solid #e8e0d4" }}>
                      <td colSpan={9} style={{ padding: "12px 20px" }}>
                        {matches.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: "#0288D1", marginBottom: 6, fontWeight: 600 }}>
                              KEYWORD MATCHES ({matches.length})
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {matches.map(kw => (
                                <span key={kw} style={{
                                  background: "#B3E5FC", color: "#01579B",
                                  border: "1px solid #81D4FA", borderRadius: 10,
                                  padding: "2px 10px", fontSize: 12,
                                }}>{kw}</span>
                              ))}
                            </div>
                          </div>
                        )}
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
                              : <a href={art.link} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 13, color: "#4a90d9", wordBreak: "break-all" }}>{art.link || "—"}</a>}
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
        {articles.length} total · {counts["auto-approved"]} auto-approved · {counts.approved} manually approved · {counts.excluded} excluded · {counts.pending} pending
      </div>
    </div>
  );
}

const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const inputStyle = { padding: "6px 12px", border: "1px solid #d0c8b8", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fff" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #4a2c1a" };
const tdStyle = { padding: "6px 8px", verticalAlign: "middle", borderRight: "1px solid #f0e8dc", fontFamily: "Crimson Text, serif" };
const cellInput = { border: "1px solid #d4af7a", borderRadius: 3, padding: "3px 6px", fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fffbf0" };
const smallBtn = (color) => ({ background: "none", border: `1px solid ${color}`, color, borderRadius: 3, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "Crimson Text, serif" });
