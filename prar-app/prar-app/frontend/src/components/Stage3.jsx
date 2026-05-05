import { useState, useEffect } from "react";
import { PART_MAP, PART_COLORS } from "../data";

const PARTS = ["All Articles", "Part 1", "Part 2", "Part 3", "Part 4"];

function assignParts(articles) {
  return articles.map(a => ({
    ...a,
    part: PART_MAP[a.journal?.trim()] || a.part || "",
  }));
}

export default function Stage3({ job, updateJob, goToStage }) {
  const [articles, setArticles] = useState(() => assignParts(job.articles || []));
  const [activeTab, setActiveTab] = useState("All Articles");
  const [editingIdx, setEditingIdx] = useState(null);

  useEffect(() => {
    updateJob({ articles });
  }, [articles]);

  function updateField(idx, field, value) {
    setArticles(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "journal") next[idx].part = PART_MAP[value?.trim()] || "";
      if (field === "part") next[idx].part = value;
      return next;
    });
  }

  function deleteArticle(idx) {
    setArticles(prev => prev.filter((_, i) => i !== idx));
  }

  function addArticle() {
    setArticles(prev => [...prev, {
      author: "", title: "", journal: "", volume: "", issue: "",
      year: "", tier: "", abstract: "Not available", link: "", part: "",
    }]);
  }

  const tabArticles = activeTab === "All Articles"
    ? articles
    : articles.filter(a => a.part === activeTab);

  const sorted = [...tabArticles].sort((a, b) => a.journal.localeCompare(b.journal));
  const sortedWithIdx = sorted.map(a => ({ ...a, _origIdx: articles.indexOf(a) }));

  const counts = PARTS.slice(1).reduce((acc, p) => {
    acc[p] = articles.filter(a => a.part === p).length;
    return acc;
  }, {});
  const unassigned = articles.filter(a => !a.part || !PARTS.includes(a.part)).length;

  const COLS = [
    { key: "journal",  label: "Journal",  w: 220 },
    { key: "title",    label: "Title",    w: 280 },
    { key: "author",   label: "Author",   w: 160 },
    { key: "volume",   label: "Vol",      w: 50  },
    { key: "issue",    label: "Issue",    w: 50  },
    { key: "year",     label: "Year",     w: 60  },
    { key: "tier",     label: "Tier",     w: 45  },
    { key: "part",     label: "Part",     w: 80  },
    { key: "abstract", label: "Abstract", w: 300 },
  ];

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={h2}>Stage 3 — Compile</h2>
          <p style={{ color: "#7a6a5a", fontSize: 14, margin: 0 }}>
            Articles are sorted by journal and assigned to Parts. Edit any cell or change the Part column to move articles.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={addArticle} style={btnOutline}>+ Add Article</button>
          <button onClick={() => { updateJob({ articles, stage: 4 }); goToStage(4); }} style={btnPrimary}>
            Proceed to Generate →
          </button>
        </div>
      </div>

      {/* Live summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={summaryCard("#2c1810", "#d4af7a")}>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{articles.length}</span>
          <span style={{ fontSize: 12 }}>Total</span>
        </div>
        {PARTS.slice(1).map(p => {
          const pc = PART_COLORS[p];
          return (
            <div key={p} style={summaryCard(pc.border, pc.text, pc.bg)}>
              <span style={{ fontSize: 22, fontWeight: 600 }}>{counts[p] || 0}</span>
              <span style={{ fontSize: 12 }}>{p}</span>
            </div>
          );
        })}
        {unassigned > 0 && (
          <div style={summaryCard("#999", "#666", "#f5f5f5")}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>{unassigned}</span>
            <span style={{ fontSize: 12 }}>Unassigned</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #e0d6c8" }}>
        {PARTS.map(p => {
          const isActive = activeTab === p;
          const pc = p === "All Articles" ? null : PART_COLORS[p];
          return (
            <button key={p} onClick={() => setActiveTab(p)} style={{
              padding: "8px 20px", border: "none", cursor: "pointer",
              fontFamily: "Crimson Text, serif", fontSize: 14,
              background: isActive ? (pc ? pc.bg : "#2c1810") : "transparent",
              color: isActive ? (pc ? pc.text : "#d4af7a") : "#888",
              borderBottom: isActive ? `3px solid ${pc ? pc.border : "#d4af7a"}` : "3px solid transparent",
              fontWeight: isActive ? 600 : 400, marginBottom: -2,
            }}>
              {p}
              {p !== "All Articles" && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({counts[p] || 0})</span>}
            </button>
          );
        })}
      </div>

      {/* Table with frozen header */}
      <div style={{ border: "1px solid #e0d6c8", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 420px)" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "#2c1810" }}>
                <th style={{ ...thStyle, width: 36 }}>#</th>
                {COLS.map(c => <th key={c.key} style={{ ...thStyle, width: c.w, minWidth: c.w }}>{c.label}</th>)}
                <th style={{ ...thStyle, width: 40 }}>Del</th>
              </tr>
            </thead>
            <tbody style={{ background: "#fff" }}>
              {sortedWithIdx.length === 0 && (
                <tr><td colSpan={COLS.length + 2} style={{ padding: 32, textAlign: "center", color: "#aaa", fontFamily: "Crimson Text, serif" }}>
                  No articles in this part.
                </td></tr>
              )}
              {sortedWithIdx.map((art, displayIdx) => {
                const origIdx = art._origIdx;
                const pc = PART_COLORS[art.part];
                const isEditing = editingIdx === origIdx;
                const prevJournal = displayIdx > 0 ? sortedWithIdx[displayIdx - 1].journal : null;
                const showJournal = activeTab === "All Articles" ? true : art.journal !== prevJournal;

                return (
                  <tr key={origIdx} style={{
                    background: pc ? pc.bg + "44" : displayIdx % 2 === 0 ? "#fff" : "#faf8f5",
                    borderBottom: "1px solid #eee",
                  }}>
                    <td style={{ ...tdStyle, color: "#aaa", fontSize: 11, textAlign: "center", width: 36 }}>{displayIdx + 1}</td>
                    {COLS.map(c => (
                      <td key={c.key} style={{
                        ...tdStyle, width: c.w,
                        background: c.key === "journal" && pc ? pc.bg : undefined,
                        fontStyle: c.key === "journal" ? "italic" : undefined,
                      }}>
                        {isEditing ? (
                          c.key === "part" ? (
                            <select value={art.part || ""} onChange={e => updateField(origIdx, "part", e.target.value)}
                              style={{ fontFamily: "Crimson Text, serif", fontSize: 12, border: "1px solid #d4af7a", borderRadius: 3, padding: "2px 4px", width: "100%" }}>
                              <option value="">—</option>
                              {["Part 1","Part 2","Part 3","Part 4"].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : c.key === "abstract" ? (
                            <textarea value={art[c.key] || ""} onChange={e => updateField(origIdx, c.key, e.target.value)}
                              style={{ ...cellInput, width: "100%", minHeight: 60, resize: "vertical", fontSize: 11 }} />
                          ) : (
                            <input value={art[c.key] || ""} onChange={e => updateField(origIdx, c.key, e.target.value)}
                              style={{ ...cellInput, width: "100%" }} />
                          )
                        ) : (
                          <div style={{
                            fontSize: c.key === "abstract" ? 11 : 13,
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: c.key === "abstract" ? "normal" : "nowrap",
                            maxWidth: c.w,
                          }} onClick={() => setEditingIdx(origIdx)}>
                            {c.key === "journal" ? (showJournal ? art[c.key] : "") :
                             c.key === "part" && pc ? <span style={{ color: pc.text, fontWeight: 600, fontSize: 11 }}>{art[c.key]}</span> :
                             c.key === "abstract" ? (art[c.key] || "").slice(0, 120) + ((art[c.key] || "").length > 120 ? "…" : "") :
                             art[c.key] || ""}
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: "center", width: 40 }}>
                      {isEditing ? (
                        <button onClick={() => setEditingIdx(null)} style={smallBtn("#388e3c")}>✓</button>
                      ) : (
                        <button onClick={() => deleteArticle(origIdx)} style={smallBtn("#d32f2f")}>✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, color: "#aaa", fontSize: 12 }}>
        {sortedWithIdx.length} articles shown · Click any cell to edit · Change "Part" column to move articles between parts
      </div>
    </div>
  );
}

const summaryCard = (border, text, bg = "#fff") => ({
  background: bg, border: `1px solid ${border}`, borderRadius: 8,
  padding: "10px 20px", display: "flex", flexDirection: "column",
  alignItems: "center", gap: 2, color: text, fontFamily: "Crimson Text, serif", minWidth: 90,
});
const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #4a2c1a", background: "#2c1810", whiteSpace: "nowrap" };
const tdStyle = { padding: "5px 8px", verticalAlign: "top", borderRight: "1px solid #f0e8dc", fontFamily: "Crimson Text, serif", cursor: "text", overflow: "hidden" };
const cellInput = { border: "1px solid #d4af7a", borderRadius: 3, padding: "3px 6px", fontFamily: "Crimson Text, serif", fontSize: 13, background: "#fffbf0" };
const smallBtn = (color) => ({ background: "none", border: `1px solid ${color}`, color, borderRadius: 3, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "Crimson Text, serif" });
