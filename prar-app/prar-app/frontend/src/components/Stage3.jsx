import { useState, useEffect, useMemo } from "react";
import { PART_MAP, PART_COLORS } from "../data";
import { COLORS, FONTS, styles } from "../lib/styles";
import { listArticles, updateArticle, deleteArticle } from "../lib/db";

const PARTS = ["All Articles", "Part 1", "Part 2", "Part 3", "Part 4"];

// Recompute `part` from `journal` using PART_MAP. Used as a fallback when an
// article comes in without a part already set; backend stamps part on /fetch,
// so usually they all have one already.
function ensurePart(a) {
  if (a.part) return a;
  return { ...a, part: PART_MAP[(a.journal || "").trim()] || "" };
}

export default function Stage3({ installment, goToStage }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("All Articles");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await listArticles(installment.id);
        // Stage 3 only sees approved/auto-approved articles.
        const approved = all
          .filter(a => a.status === "approved" || a.status === "auto-approved")
          .map(ensurePart);
        // Persist any newly-computed parts (rare — backend usually does it).
        const needPart = approved.filter(a => {
          const wasMissing = !all.find(o => o.id === a.id)?.part;
          return wasMissing && a.part;
        });
        if (!cancelled) setArticles(approved);
        if (needPart.length > 0) {
          // Fire-and-forget.
          Promise.all(needPart.map(a => updateArticle(a.id, { part: a.part })))
            .catch(err => console.error("Persist part failed:", err));
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load articles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [installment.id]);

  async function updateField(id, field, value) {
    setArticles(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };
      if (field === "journal") updated.part = PART_MAP[(value || "").trim()] || "";
      return updated;
    }));
    try {
      const patch = { [field]: value };
      if (field === "journal") patch.part = PART_MAP[(value || "").trim()] || "";
      await updateArticle(id, patch);
    } catch (err) {
      setError(err.message || "Could not save change.");
    }
  }

  async function handleDelete(id) {
    const prev = articles;
    setArticles(prev.filter(a => a.id !== id));
    try { await deleteArticle(id); }
    catch (err) { setArticles(prev); setError(err.message || "Could not delete article."); }
  }

  const tabArticles = activeTab === "All Articles"
    ? articles
    : articles.filter(a => a.part === activeTab);

  const sorted = useMemo(
    () => [...tabArticles].sort((a, b) => (a.journal || "").localeCompare(b.journal || "")),
    [tabArticles]
  );

  const counts = useMemo(() => {
    const out = {};
    for (const p of PARTS.slice(1)) out[p] = articles.filter(a => a.part === p).length;
    return out;
  }, [articles]);
  const unassigned = articles.filter(a => !a.part || !PARTS.includes(a.part)).length;

  const COLS = [
    { key: "journal",  label: "Journal",  w: 220 },
    { key: "title",    label: "Title",    w: 280 },
    { key: "author",   label: "Author",   w: 160 },
    { key: "volume",   label: "Vol",      w: 50  },
    { key: "issue",    label: "Issue",    w: 50  },
    { key: "year",     label: "Year",     w: 60  },
    { key: "tier",     label: "Tier",     w: 45  },
    { key: "part",     label: "Part",     w: 90  },
    { key: "abstract", label: "Abstract", w: 300 },
  ];

  if (loading) {
    return <div style={{ padding: 80, textAlign: "center", color: COLORS.textMuted, fontFamily: FONTS.serif }}>Loading approved articles…</div>;
  }
  if (loadError) {
    return (
      <div style={{ padding: 80, textAlign: "center", fontFamily: FONTS.serif }}>
        <div style={{ color: COLORS.danger, marginBottom: 12 }}>{loadError}</div>
        <button onClick={() => window.location.reload()} style={styles.btnOutline}>Reload</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={styles.h2}>Stage 3 — Compile</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 760 }}>
            Articles are auto-assigned to Parts based on their journal — this is a suggestion.
            Reassign via the Part column to balance counts across the four parts and group similar-subject journals together.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => goToStage(4)} style={styles.btnPrimary}>
            Proceed to Generate →
          </button>
        </div>
      </div>

      {error && <div style={styles.banner("error")} role="alert">{error}</div>}

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={summaryCard(COLORS.gold, COLORS.gold, COLORS.bgPanel)}>
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
          <div style={summaryCard(COLORS.textFaint, COLORS.textMuted, COLORS.bgPanelAlt)}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>{unassigned}</span>
            <span style={{ fontSize: 12 }}>Unassigned</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `2px solid ${COLORS.borderSoft}`, marginBottom: 0, flexWrap: "wrap" }}>
        {PARTS.map(p => {
          const isActive = activeTab === p;
          const pc = p === "All Articles" ? null : PART_COLORS[p];
          return (
            <button key={p} onClick={() => setActiveTab(p)} style={{
              padding: "8px 20px", border: "none", cursor: "pointer",
              fontFamily: FONTS.serif, fontSize: 14,
              background: isActive ? (pc ? pc.bg : COLORS.bgPanel) : "transparent",
              color: isActive ? (pc ? pc.text : COLORS.gold) : COLORS.textMuted,
              borderBottom: isActive ? `3px solid ${pc ? pc.border : COLORS.gold}` : "3px solid transparent",
              fontWeight: isActive ? 600 : 400, marginBottom: -2,
            }}>
              {p}
              {p !== "All Articles" && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({counts[p] || 0})</span>}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${COLORS.borderSoft}`, borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden", background: COLORS.bgPanel }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: COLORS.bgPanelDeep }}>
                <th style={thStyle(36)}>#</th>
                {COLS.map(c => <th key={c.key} style={thStyle(c.w)}>{c.label}</th>)}
                <th style={thStyle(40)}>Del</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={COLS.length + 2} style={{ padding: 32, textAlign: "center", color: COLORS.textFaint, fontFamily: FONTS.serif }}>
                  No articles in this part.
                </td></tr>
              )}
              {sorted.map((art, displayIdx) => {
                const pc = PART_COLORS[art.part];
                const isEditing = editingId === art.id;
                const prevJournal = displayIdx > 0 ? sorted[displayIdx - 1].journal : null;
                const showJournal = activeTab === "All Articles" ? true : art.journal !== prevJournal;

                return (
                  <tr key={art.id} style={{
                    background: displayIdx % 2 === 0 ? COLORS.bgPanel : COLORS.bgPanelAlt,
                    borderBottom: `1px solid ${COLORS.borderHair}`,
                  }}>
                    <td style={tdStyle({ width: 36, textAlign: "center", color: COLORS.textFaint, fontSize: 11 })}>{displayIdx + 1}</td>
                    {COLS.map(c => (
                      <td key={c.key} style={tdStyle({
                        width: c.w,
                        fontStyle: c.key === "journal" ? "italic" : undefined,
                      })}>
                        {isEditing ? (
                          c.key === "part" ? (
                            <select value={art.part || ""} onChange={e => updateField(art.id, "part", e.target.value)}
                              aria-label="Part"
                              style={{
                                fontFamily: FONTS.serif, fontSize: 12,
                                border: `1px solid ${COLORS.borderFocus}`, borderRadius: 3,
                                padding: "2px 4px", width: "100%",
                                background: COLORS.bgPanelDeep, color: COLORS.textBody,
                              }}>
                              <option value="">—</option>
                              {["Part 1","Part 2","Part 3","Part 4"].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : c.key === "abstract" ? (
                            <textarea value={art[c.key] || ""} onChange={e => updateField(art.id, c.key, e.target.value)}
                              aria-label={c.label}
                              style={{ ...cellInput, width: "100%", minHeight: 60, resize: "vertical", fontSize: 11 }} />
                          ) : (
                            <input value={art[c.key] || ""} onChange={e => updateField(art.id, c.key, e.target.value)}
                              aria-label={c.label}
                              style={{ ...cellInput, width: "100%" }} />
                          )
                        ) : (
                          <div style={{
                            fontSize: c.key === "abstract" ? 11 : 13,
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: c.key === "abstract" ? "normal" : "nowrap",
                            maxWidth: c.w,
                            color: c.key === "journal" ? COLORS.gold : COLORS.textBody,
                          }} onClick={() => setEditingId(art.id)}>
                            {c.key === "journal" ? (showJournal ? art[c.key] : "") :
                             c.key === "part" && pc ? <span style={{
                               color: pc.text, fontWeight: 600, fontSize: 11,
                               background: pc.bg, padding: "2px 8px", borderRadius: 10,
                               border: `1px solid ${pc.border}`,
                             }}>{art[c.key]}</span> :
                             c.key === "abstract" ? (art[c.key] || "").slice(0, 120) + ((art[c.key] || "").length > 120 ? "…" : "") :
                             art[c.key] || ""}
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={tdStyle({ textAlign: "center", width: 40 })}>
                      {isEditing ? (
                        <button onClick={() => setEditingId(null)} aria-label="Finish editing"
                          style={iconBtn(COLORS.success)}>✓</button>
                      ) : (
                        <button onClick={() => handleDelete(art.id)} aria-label="Delete"
                          style={iconBtn(COLORS.danger)}>✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, color: COLORS.textFaint, fontSize: 12 }}>
        {sorted.length} articles shown · Click any cell to edit · Change "Part" column to move articles between parts.
      </div>
    </div>
  );
}

// ─── Cell styles ─────────────────────────────────────────────────────────────

function thStyle(width) {
  return {
    padding: "10px 8px",
    color: COLORS.goldMuted,
    fontFamily: FONTS.serif,
    fontSize: 11, fontWeight: 600,
    textAlign: "left",
    letterSpacing: "0.7px", textTransform: "uppercase",
    borderRight: `1px solid ${COLORS.borderHair}`,
    borderBottom: `2px solid ${COLORS.gold}`,
    background: COLORS.bgPanelDeep,
    whiteSpace: "nowrap",
    width, minWidth: width,
  };
}
function tdStyle(extra = {}) {
  return {
    padding: "5px 8px",
    verticalAlign: "top",
    borderRight: `1px solid ${COLORS.borderHair}`,
    fontFamily: FONTS.serif,
    color: COLORS.textBody,
    cursor: "text",
    overflow: "hidden",
    ...extra,
  };
}
const cellInput = {
  border: `1px solid ${COLORS.borderFocus}`,
  borderRadius: 3,
  padding: "3px 6px",
  fontFamily: FONTS.serif,
  fontSize: 13,
  background: COLORS.bgPanelDeep,
  color: COLORS.textBody,
  boxSizing: "border-box",
};
function iconBtn(color) {
  return {
    background: "none",
    border: `1px solid ${color}`,
    color,
    borderRadius: 3,
    padding: "2px 7px",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: FONTS.serif,
  };
}
function summaryCard(border, text, bg) {
  return {
    background: bg, border: `1px solid ${border}`, borderRadius: 8,
    padding: "10px 20px", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 2, color: text,
    fontFamily: FONTS.serif, minWidth: 90,
  };
}
