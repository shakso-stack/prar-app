import { useState, useEffect } from "react";

const DEFAULT_KEYWORDS = [
  "Algeria","Bahrain","Comoros","Djibouti","Egypt","Iraq","Iran","Israel",
  "Jordan","Kuwait","Lebanon","Libya","Mauritania","Morocco","Oman",
  "Palestine","Qatar","Saudi Arabia","Somalia","Sudan","Syria","Tunisia",
  "Turkey","United Arab Emirates","Yemen",
  "Turkish","Arab","Arabic","Kurdish","Kurdistan",
  "Gulf","GCC","Levant","Maghreb","MENA","Mesopotamia","Ottoman",
  "Saudi","UAE","North Africa","Middle East",
];

const STATUS_COLORS = {
  pending:         { bg: "#FFF9C4", border: "#F9A825", text: "#795400" },
  approved:        { bg: "#C8E6C9", border: "#388E3C", text: "#1B5E20" },
  "auto-approved": { bg: "#B3E5FC", border: "#0288D1", text: "#01579B" },
  excluded:        { bg: "#FFCDD2", border: "#D32F2F", text: "#B71C1C" },
};

function getMatches(article, keywords) {
  const haystack = [article.title || "", article.abstract || "", article.journal || ""].join(" ").toLowerCase();
  return keywords.filter(kw => haystack.includes(kw.toLowerCase()));
}

function applyKeywords(articles, keywords) {
  return articles.map(a => {
    const matches = getMatches(a, keywords);
    const hasMatch = matches.length > 0;
    let status = a.status;
    if (status === "pending" || status === "auto-approved" || !status) {
      status = hasMatch ? "auto-approved" : "pending";
    }
    return { ...a, keywordMatches: matches, status };
  });
}

export default function Stage2({ job, updateJob, goToStage }) {
  const [keywords, setKeywords] = useState(() => job.keywords || DEFAULT_KEYWORDS);
  const [articles, setArticles] = useState(() => applyKeywords(job.articles || [], job.keywords || DEFAULT_KEYWORDS));
  const [statusFilter, setStatusFilter] = useState("all");
  const [journalFilter, setJournalFilter] = useState("all");
  const [keywordFilters, setKeywordFilters] = useState([]);
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showKeywords, setShowKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

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
    setArticles(prev => prev.map((a, i) => {
      if (i !== idx) return a;
      const updated = { ...a, [field]: value };
      if (["title", "abstract", "journal"].includes(field)) {
        updated.keywordMatches = getMatches(updated, keywords);
      }
      return updated;
    }));
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
    setKeywordFilters(prev => prev.filter(k => k !== kw));
  }

  function resetKeywords() {
    if (window.confirm("Reset to the default keyword list?")) {
      setKeywords(DEFAULT_KEYWORDS);
      setKeywordFilters([]);
    }
  }

  function toggleKeywordFilter(kw) {
    setKeywordFilters(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    );
  }

  // All unique journals
  const allJournals = [...new Set(articles.map(a => a.journal).filter(Boolean))].sort();

  // All unique matched keywords across all articles
  const allMatchedKeywords = [...new Set(articles.flatMap(a => a.keywordMatches || []))].sort();

  const counts = {
    all: articles.length,
    pending: articles.filter(a => !a.status || a.status === "pending").length,
    "auto-approved": articles.filter(a => a.status === "auto-approved").length,
    approved: articles.filter(a => a.status === "approved").length,
    excluded: articles.filter(a => a.status === "excluded").length,
  };

  // Review progress
  const reviewedCount = articles.filter(a => a.status && a.status !== "pending").length;
  const reviewPct = articles.length > 0 ? Math.round((reviewedCount / articles.length) * 100) : 0;

  const filtered = articles
    .map((a, i) => ({ ...a, _idx: i }))
    .filter(a => {
      if (statusFilter !== "all" && (a.status || "pending") !== statusFilter) return false;
      if (journalFilter !== "all" && a.journal !== journalFilter) return false;
      if (keywordFilters.length > 0) {
        const matches = a.keywordMatches || [];
        if (!keywordFilters.some(kf => matches.includes(kf))) return false;
      }
      return true;
    });

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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={h2}>Stage 2 — Review Articles</h2>
          <p style={{ color: "#7a6a5a", fontSize: 14, margin: 0 }}>
            Articles matching your keywords are Auto-Approved. Review Pending articles manually before proceeding.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
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

      {/* Review progress */}
      <div style={{ background: "#f8f6f1", border: "1px solid #e0d6c8", borderRadius: 8, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 13, color: "#5a4a3a", minWidth: 180 }}>
          Review progress: <strong>{reviewedCount} / {articles.length}</strong> articles ({reviewPct}%)
        </div>
        <div style={{ flex: 1, background: "#e0d6c8", borderRadius: 4, height: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4, transition: "width 0.4s",
            background: reviewPct === 100 ? "#388E3C" : "#d4af7a",
            width: `${reviewPct}%`,
          }} />
        </div>
        <div style={{ fontSize: 12, color: "#888", minWidth: 120, textAlign: "right" }}>
          {counts.pending} pending · {counts["auto-approved"]} auto · {counts.approved} manual · {counts.excluded} excluded
        </div>
      </div>

      {/* Keyword panel */}
      {showKeywords && (
        <div style={{ background: "#e8f4fd", border: "1px solid #90CAF9", borderRadius: 8, padding: "16px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#01579B" }}>
              Keywords — articles matching any of these in Title, Abstract, or Journal are Auto-Approved
            </div>
            <button onClick={resetKeywords} style={{ ...smallBtn("#01579B"), fontSize: 12, padding: "3px 10px" }}>Reset to Default</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {keywords.map(kw => (
              <span key={kw} style={{
                background: "#fff", border: "1px solid #90CAF9", borderRadius: 14,
                padding: "2px 10px", fontSize: 12, color: "#01579B",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} style={{ background: "none", border: "none", color: "#90CAF9", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
                  onMouseEnter={e => e.target.style.color = "#D32F2F"}
                  onMouseLeave={e => e.target.style.color = "#90CAF9"}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder="Add a keyword..." style={{ ...inputStyle, width: 220 }} />
            <button onClick={addKeyword} style={{ ...btnOutline, borderColor: "#0288D1", color: "#0288D1" }}>+ Add</button>
          </div>
        </div>
      )}

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {/* Status filters */}
        {["all", "pending", "auto-approved", "approved", "excluded"].map(s => {
          const sc = STATUS_COLORS[s];
          const isActive = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
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

        <div style={{ width: 1, height: 24, background: "#d0c8b8", margin: "0 4px" }} />

        {/* Journal filter */}
        <select value={journalFilter} onChange={e => setJournalFilter(e.target.value)} style={{
          ...inputStyle, padding: "5px 10px", fontSize: 13, maxWidth: 220,
        }}>
          <option value="all">All Journals</option>
          {allJournals.map(j => <option key={j} value={j}>{j}</option>)}
        </select>

        {/* Keyword filter */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowKeywordDropdown(s => !s)} style={{
            ...btnOutline, fontSize: 13, padding: "5px 14px",
            borderColor: keywordFilters.length > 0 ? "#0288D1" : "#2c1810",
            color: keywordFilters.length > 0 ? "#0288D1" : "#2c1810",
          }}>
            {keywordFilters.length > 0 ? `Keywords: ${keywordFilters.length} selected` : "Filter by Keyword"} ▾
          </button>
          {showKeywordDropdown && (
            <div style={{
              position: "absolute", top: "100%", left: 0, zIndex: 50,
              background: "#fff", border: "1px solid #d0c8b8", borderRadius: 8,
              padding: "8px 0", minWidth: 220, maxHeight: 300, overflowY: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)", marginTop: 4,
            }}>
              {keywordFilters.length > 0 && (
                <button onClick={() => setKeywordFilters([])} style={{
                  width: "100%", textAlign: "left", padding: "6px 14px",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "Crimson Text, serif", fontSize: 12, color: "#e53935",
                }}>✕ Clear selection</button>
              )}
              {allMatchedKeywords.length === 0 && (
                <div style={{ padding: "8px 14px", fontSize: 12, color: "#aaa" }}>No keyword matches yet</div>
              )}
              {allMatchedKeywords.map(kw => (
                <label key={kw} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 14px", cursor: "pointer",
                  background: keywordFilters.includes(kw) ? "#e8f4fd" : "transparent",
                  fontFamily: "Crimson Text, serif", fontSize: 13,
                }}>
                  <input type="checkbox" checked={keywordFilters.includes(kw)}
                    onChange={() => toggleKeywordFilter(kw)} style={{ cursor: "pointer" }} />
                  {kw}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#aaa" }}>
                    ({articles.filter(a => (a.keywordMatches || []).includes(kw)).length})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Clear all filters */}
        {(journalFilter !== "all" || keywordFilters.length > 0 || statusFilter !== "all") && (
          <button onClick={() => { setJournalFilter("all"); setKeywordFilters([]); setStatusFilter("all"); setShowKeywordDropdown(false); }}
            style={{ ...btnOutline, fontSize: 12, color: "#e53935", borderColor: "#e53935", padding: "4px 12px" }}>
            ✕ Clear filters
          </button>
        )}

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>
          {filtered.length} of {articles.length} shown
        </div>
      </div>

      {/* Table with frozen header */}
      <div style={{ border: "1px solid #e0d6c8", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 380px)" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "#2c1810" }}>
                {[
                  { label: "#", w: 36 },
                  { label: "Status", w: 115 },
                  { label: "Title / Author", w: 260 },
                  { label: "Journal", w: 180 },
                  { label: "Vol", w: 50 },
                  { label: "Issue", w: 50 },
                  { label: "Year", w: 55 },
                  { label: "Keywords", w: 160 },
                  { label: "Actions", w: 110 },
                ].map(h => (
                  <th key={h.label} style={{ ...thStyle, width: h.w, minWidth: h.w }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: "#fff" }}>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#aaa", fontFamily: "Crimson Text, serif" }}>
                  No articles match the current filters.
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
                      <td style={{ ...tdStyle, width: 115 }}>
                        <select value={art.status || "pending"} onChange={e => setStatus(idx, e.target.value)} style={{
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
                      <td style={{ ...tdStyle, width: 260 }}>
                        {isEditing
                          ? <input value={art.title} onChange={e => updateField(idx, "title", e.target.value)} style={cellInput} />
                          : <div>
                              <div style={{ fontWeight: 500, fontSize: 13, color: "#2c1810", lineHeight: 1.3 }}>{art.title || "—"}</div>
                              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{art.author || ""}</div>
                            </div>}
                      </td>
                      <td style={{ ...tdStyle, width: 180, fontSize: 12 }}>
                        {isEditing ? <input value={art.journal} onChange={e => updateField(idx, "journal", e.target.value)} style={cellInput} /> : art.journal}
                      </td>
                      <td style={{ ...tdStyle, width: 50, fontSize: 12 }}>
                        {isEditing ? <input value={art.volume} onChange={e => updateField(idx, "volume", e.target.value)} style={cellInput} /> : art.volume}
                      </td>
                      <td style={{ ...tdStyle, width: 50, fontSize: 12 }}>
                        {isEditing ? <input value={art.issue} onChange={e => updateField(idx, "issue", e.target.value)} style={cellInput} /> : art.issue}
                      </td>
                      <td style={{ ...tdStyle, width: 55, fontSize: 12 }}>
                        {isEditing ? <input value={art.year} onChange={e => updateField(idx, "year", e.target.value)} style={cellInput} /> : art.year}
                      </td>
                      <td style={{ ...tdStyle, width: 160 }}>
                        {matches.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {matches.slice(0, 3).map(kw => (
                              <span key={kw} style={{ background: "#B3E5FC", color: "#01579B", border: "1px solid #81D4FA", borderRadius: 10, padding: "1px 7px", fontSize: 10, whiteSpace: "nowrap" }}>{kw}</span>
                            ))}
                            {matches.length > 3 && <span style={{ fontSize: 10, color: "#0288D1", alignSelf: "center" }}>+{matches.length - 3}</span>}
                          </div>
                        ) : (
                          <span style={{ background: "#FFF9C4", color: "#795400", border: "1px solid #F9A825", borderRadius: 10, padding: "1px 8px", fontSize: 10 }}>⚠ No match</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, width: 110 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => setExpanded(isExpanded ? null : idx)} style={smallBtn("#4a90d9")}>{isExpanded ? "▲" : "▼"}</button>
                          <button onClick={() => setEditingId(isEditing ? null : idx)} style={smallBtn(isEditing ? "#388e3c" : "#ff9800")}>{isEditing ? "✓" : "Edit"}</button>
                          <button onClick={() => deleteArticle(idx)} style={smallBtn("#d32f2f")}>✕</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${idx}-exp`} style={{ background: "#fffbf0", borderBottom: "1px solid #e8e0d4" }}>
                        <td colSpan={9} style={{ padding: "12px 20px" }}>
                          {matches.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: "#0288D1", marginBottom: 6, fontWeight: 600 }}>KEYWORD MATCHES ({matches.length})</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {matches.map(kw => (
                                  <span key={kw} style={{ background: "#B3E5FC", color: "#01579B", border: "1px solid #81D4FA", borderRadius: 10, padding: "2px 10px", fontSize: 12 }}>{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>AUTHOR</div>
                              {isEditing ? <input value={art.author} onChange={e => updateField(idx, "author", e.target.value)} style={{ ...cellInput, width: "100%" }} />
                                : <div style={{ fontSize: 13 }}>{art.author || "—"}</div>}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>LINK</div>
                              {isEditing ? <input value={art.link} onChange={e => updateField(idx, "link", e.target.value)} style={{ ...cellInput, width: "100%" }} />
                                : <a href={art.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#4a90d9", wordBreak: "break-all" }}>{art.link || "—"}</a>}
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>ABSTRACT</div>
                              {isEditing ? <textarea value={art.abstract} onChange={e => updateField(idx, "abstract", e.target.value)} style={{ ...cellInput, width: "100%", minHeight: 80, resize: "vertical" }} />
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
      </div>

      <div style={{ marginTop: 10, color: "#aaa", fontSize: 12 }}>
        {filtered.length} shown · {articles.length} total · {counts["auto-approved"]} auto-approved · {counts.approved} manually approved · {counts.excluded} excluded · {counts.pending} pending
      </div>
    </div>
  );
}

const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const inputStyle = { padding: "6px 10px", border: "1px solid #d0c8b8", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fff" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #4a2c1a", background: "#2c1810" };
const tdStyle = { padding: "6px 8px", verticalAlign: "middle", borderRight: "1px solid #f0e8dc", fontFamily: "Crimson Text, serif", overflow: "hidden" };
const cellInput = { border: "1px solid #d4af7a", borderRadius: 3, padding: "3px 6px", fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fffbf0" };
const smallBtn = (color) => ({ background: "none", border: `1px solid ${color}`, color, borderRadius: 3, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "Crimson Text, serif" });
