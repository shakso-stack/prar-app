import { useState, useEffect, useMemo } from "react";
import { COLORS, FONTS, styles } from "../lib/styles";
import {
  listArticles, listKeywords, updateArticle, updateArticles, deleteArticle,
  addKeyword, removeKeyword, replaceKeywordsForInstallment,
} from "../lib/db";

const DEFAULT_KEYWORDS = [
  "Algeria","Bahrain","Comoros","Djibouti","Egypt","Iraq","Iran","Israel",
  "Jordan","Kuwait","Lebanon","Libya","Mauritania","Morocco","Oman",
  "Palestine","Qatar","Saudi Arabia","Somalia","Sudan","Syria","Tunisia",
  "Turkey","United Arab Emirates","Yemen",
  "Turkish","Arab","Arabic","Kurdish","Kurdistan",
  "Gulf","GCC","Levant","Maghreb","MENA","Mesopotamia","Ottoman",
  "Saudi","UAE","North Africa","Middle East",
];

// Status visual treatment — calibrated for the dark panel background.
const STATUS_STYLE = {
  pending:         { color: COLORS.warning, bg: "rgba(232,181,115,0.10)", border: "rgba(232,181,115,0.40)" },
  approved:        { color: COLORS.success, bg: "rgba(124,191,153,0.10)", border: "rgba(124,191,153,0.40)" },
  "auto-approved": { color: COLORS.info,    bg: "rgba(133,179,212,0.10)", border: "rgba(133,179,212,0.40)" },
  excluded:        { color: COLORS.danger,  bg: "rgba(224,124,124,0.10)", border: "rgba(224,124,124,0.40)" },
};

function getMatches(article, keywords) {
  const haystack = [article.title || "", article.abstract || "", article.journal || ""].join(" ").toLowerCase();
  return keywords.filter(kw => haystack.includes(kw.toLowerCase()));
}

export default function Stage2({ installment, goToStage }) {
  const [articles, setArticles] = useState([]);
  const [keywordRows, setKeywordRows] = useState([]); // [{id, keyword, position}]
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [journalFilter, setJournalFilter] = useState("all");
  const [keywordFilters, setKeywordFilters] = useState([]);
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showKeywords, setShowKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [error, setError] = useState("");

  const keywords = useMemo(() => keywordRows.map(k => k.keyword), [keywordRows]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [arts, kws] = await Promise.all([
          listArticles(installment.id),
          listKeywords(installment.id),
        ]);
        if (cancelled) return;

        // Seed default keywords on first entry into Stage 2.
        let useKws = kws;
        if (kws.length === 0) {
          useKws = await replaceKeywordsForInstallment(installment.id, DEFAULT_KEYWORDS);
        }
        const kwList = useKws.map(k => k.keyword);

        // Compute initial matches for any articles that are still pending
        // or auto-approved (i.e. their status was never set manually).
        const updatesToPersist = [];
        const withMatches = arts.map(a => {
          const matches = getMatches(a, kwList);
          const hasMatch = matches.length > 0;
          const currentStatus = a.status || "pending";
          let nextStatus = currentStatus;
          if (currentStatus === "pending" || currentStatus === "auto-approved") {
            nextStatus = hasMatch ? "auto-approved" : "pending";
          }
          const newMatches = matches;
          const matchesChanged = JSON.stringify(a.matched_keywords || []) !== JSON.stringify(newMatches);
          const statusChanged = nextStatus !== currentStatus;
          if (matchesChanged || statusChanged) {
            updatesToPersist.push({
              id: a.id,
              status: nextStatus,
              matched_keywords: newMatches,
            });
          }
          return { ...a, status: nextStatus, matched_keywords: newMatches };
        });

        setArticles(withMatches);
        setKeywordRows(useKws);

        // Fire-and-forget persistence of computed matches/statuses. Don't
        // block the UI on this.
        if (updatesToPersist.length > 0) {
          updateArticles(updatesToPersist).catch(err =>
            console.error("Persisting initial matches failed:", err));
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load Stage 2 data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [installment.id]);

  // ─── Mutations ──────────────────────────────────────────────────────────

  async function setStatus(id, status) {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    try { await updateArticle(id, { status }); }
    catch (err) { setError(err.message || "Could not save status."); }
  }

  async function updateField(id, field, value) {
    setArticles(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };
      if (["title", "abstract", "journal"].includes(field)) {
        updated.matched_keywords = getMatches(updated, keywords);
      }
      return updated;
    }));
    try {
      const patch = { [field]: value };
      if (["title", "abstract", "journal"].includes(field)) {
        const after = articles.find(a => a.id === id);
        if (after) {
          const newMatches = getMatches({ ...after, [field]: value }, keywords);
          patch.matched_keywords = newMatches;
        }
      }
      await updateArticle(id, patch);
    } catch (err) {
      setError(err.message || "Could not save change.");
    }
  }

  async function handleDeleteArticle(id) {
    const prev = articles;
    setArticles(prev.filter(a => a.id !== id));
    try { await deleteArticle(id); }
    catch (err) { setArticles(prev); setError(err.message || "Could not delete."); }
  }

  async function handleAddKeyword() {
    const kw = newKeyword.trim();
    if (!kw || keywords.includes(kw)) return;
    try {
      const created = await addKeyword(installment.id, kw);
      const nextRows = [...keywordRows, created];
      setKeywordRows(nextRows);
      setNewKeyword("");
      await reapplyKeywords(nextRows.map(k => k.keyword));
    } catch (err) {
      setError(err.message || "Could not add keyword.");
    }
  }

  async function handleRemoveKeyword(kwString) {
    const target = keywordRows.find(k => k.keyword === kwString);
    if (!target) return;
    try {
      await removeKeyword(target.id);
      const nextRows = keywordRows.filter(k => k.id !== target.id);
      setKeywordRows(nextRows);
      setKeywordFilters(prev => prev.filter(k => k !== kwString));
      await reapplyKeywords(nextRows.map(k => k.keyword));
    } catch (err) {
      setError(err.message || "Could not remove keyword.");
    }
  }

  async function handleResetKeywords() {
    if (!window.confirm("Reset to the default keyword list?")) return;
    try {
      const rows = await replaceKeywordsForInstallment(installment.id, DEFAULT_KEYWORDS);
      setKeywordRows(rows);
      setKeywordFilters([]);
      await reapplyKeywords(DEFAULT_KEYWORDS);
    } catch (err) {
      setError(err.message || "Could not reset keywords.");
    }
  }

  // When the keyword set changes, re-run the match for all articles whose
  // status is pending or auto-approved (i.e. not manually decided), and
  // persist any status/match changes.
  async function reapplyKeywords(kwList) {
    const updates = [];
    const nextArticles = articles.map(a => {
      const matches = getMatches(a, kwList);
      const hasMatch = matches.length > 0;
      const currentStatus = a.status || "pending";
      let nextStatus = currentStatus;
      if (currentStatus === "pending" || currentStatus === "auto-approved") {
        nextStatus = hasMatch ? "auto-approved" : "pending";
      }
      const matchesChanged = JSON.stringify(a.matched_keywords || []) !== JSON.stringify(matches);
      const statusChanged = nextStatus !== currentStatus;
      if (matchesChanged || statusChanged) {
        updates.push({ id: a.id, status: nextStatus, matched_keywords: matches });
      }
      return { ...a, status: nextStatus, matched_keywords: matches };
    });
    setArticles(nextArticles);
    if (updates.length > 0) {
      try { await updateArticles(updates); }
      catch (err) { setError(err.message || "Could not update matches."); }
    }
  }

  function toggleKeywordFilter(kw) {
    setKeywordFilters(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]);
  }

  // ─── Derived state ──────────────────────────────────────────────────────

  const allJournals = useMemo(
    () => [...new Set(articles.map(a => a.journal).filter(Boolean))].sort(),
    [articles]
  );
  const allMatchedKeywords = useMemo(
    () => [...new Set(articles.flatMap(a => a.matched_keywords || []))].sort(),
    [articles]
  );
  const counts = useMemo(() => ({
    all: articles.length,
    pending: articles.filter(a => !a.status || a.status === "pending").length,
    "auto-approved": articles.filter(a => a.status === "auto-approved").length,
    approved: articles.filter(a => a.status === "approved").length,
    excluded: articles.filter(a => a.status === "excluded").length,
  }), [articles]);

  const reviewedCount = counts.approved + counts["auto-approved"] + counts.excluded;
  const reviewPct = articles.length > 0 ? Math.round((reviewedCount / articles.length) * 100) : 0;

  const filtered = useMemo(() => {
    return articles.filter(a => {
      if (statusFilter !== "all" && (a.status || "pending") !== statusFilter) return false;
      if (journalFilter !== "all" && a.journal !== journalFilter) return false;
      if (keywordFilters.length > 0) {
        const matches = a.matched_keywords || [];
        if (!keywordFilters.some(kf => matches.includes(kf))) return false;
      }
      return true;
    });
  }, [articles, statusFilter, journalFilter, keywordFilters]);

  function handleProceed() {
    // Don't filter or strip anything destructively; Stage 3 reads articles
    // again and filters to approved/auto-approved. Just advance stage.
    goToStage(3);
  }

  const approvedCount = counts.approved + counts["auto-approved"];

  if (loading) {
    return <div style={{ padding: 80, textAlign: "center", color: COLORS.textMuted, fontFamily: FONTS.serif }}>Loading articles…</div>;
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
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={styles.h2}>Stage 2 — Review Articles</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 760 }}>
            Review every article, Auto-Approved ones too (matched on keyword in title, abstract, or journal name).
            Exclude anything not related to the Middle East or Arab world, and anything that isn't a research article
            (e.g. book reviews, editorials, front or back matter).
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setShowKeywords(s => !s)} style={{
            ...styles.btnOutline,
            borderColor: showKeywords ? COLORS.gold : COLORS.goldMuted,
            color: showKeywords ? COLORS.gold : COLORS.goldMuted,
          }}>
            {showKeywords ? "▲ Hide Keywords" : "▼ Keywords"} ({keywords.length})
          </button>
          <button onClick={handleProceed} disabled={approvedCount === 0}
            style={{ ...styles.btnPrimary, opacity: approvedCount === 0 ? 0.5 : 1, cursor: approvedCount === 0 ? "default" : "pointer" }}>
            Proceed to Compile ({approvedCount} approved) →
          </button>
        </div>
      </div>

      {error && <div style={styles.banner("error")} role="alert">{error}</div>}

      {/* Review progress */}
      <div style={{
        background: COLORS.bgPanel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8,
        padding: "10px 16px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 13, color: COLORS.textMuted, minWidth: 180 }}>
          Review progress: <strong style={{ color: COLORS.gold }}>{reviewedCount} / {articles.length}</strong> articles ({reviewPct}%)
        </div>
        <div style={{ flex: 1, minWidth: 200, background: COLORS.bgPanelDeep, borderRadius: 4, height: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4, transition: "width 0.4s",
            background: reviewPct === 100 ? COLORS.success : COLORS.gold,
            width: `${reviewPct}%`,
          }} />
        </div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, minWidth: 200, textAlign: "right" }}>
          {counts.pending} pending · {counts["auto-approved"]} auto · {counts.approved} manual · {counts.excluded} excluded
        </div>
      </div>

      {/* Keyword panel */}
      {showKeywords && (
        <div style={{ ...styles.card, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold, fontFamily: FONTS.serif }}>
              Keywords — articles matching any of these in Title, Abstract, or Journal are Auto-Approved
            </div>
            <button onClick={handleResetKeywords} style={{ ...styles.btnSubtle, fontSize: 12, padding: "4px 12px" }}>Reset to Default</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {keywords.map(kw => (
              <span key={kw} style={{
                background: COLORS.bgPanelDeep, border: `1px solid ${COLORS.borderSoft}`,
                borderRadius: 14, padding: "2px 10px", fontSize: 12,
                color: COLORS.textBody, fontFamily: FONTS.serif,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {kw}
                <button onClick={() => handleRemoveKeyword(kw)}
                  aria-label={`Remove keyword ${kw}`}
                  style={{
                    background: "none", border: "none", color: COLORS.textMuted,
                    cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1,
                  }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddKeyword()}
              placeholder="Add a keyword…"
              style={{ ...styles.input, width: 240 }}
              aria-label="New keyword" />
            <button onClick={handleAddKeyword} style={styles.btnOutline}>+ Add</button>
          </div>
        </div>
      )}

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "pending", "auto-approved", "approved", "excluded"].map(s => {
          const sc = STATUS_STYLE[s];
          const isActive = statusFilter === s;
          const label = s === "auto-approved" ? "Auto-Approved" : s.charAt(0).toUpperCase() + s.slice(1);
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "5px 14px", borderRadius: 20,
              fontFamily: FONTS.serif, fontSize: 12, cursor: "pointer",
              border: `1px solid ${isActive ? (sc?.border || COLORS.gold) : COLORS.borderSoft}`,
              background: isActive ? (sc?.bg || COLORS.goldSoft) : "transparent",
              color: isActive ? (sc?.color || COLORS.gold) : COLORS.textMuted,
              fontWeight: isActive ? 600 : 400,
            }}>
              {label} ({counts[s] || 0})
            </button>
          );
        })}

        <div style={{ width: 1, height: 24, background: COLORS.borderSoft, margin: "0 4px" }} />

        <select value={journalFilter} onChange={e => setJournalFilter(e.target.value)}
          aria-label="Filter by journal"
          style={{ ...styles.input, padding: "5px 10px", fontSize: 13, width: "auto", maxWidth: 240 }}>
          <option value="all">All Journals</option>
          {allJournals.map(j => <option key={j} value={j}>{j}</option>)}
        </select>

        <div style={{ position: "relative" }}>
          <button onClick={() => setShowKeywordDropdown(s => !s)} style={{
            ...styles.btnOutline, fontSize: 13, padding: "5px 14px",
            borderColor: keywordFilters.length > 0 ? COLORS.info : COLORS.goldMuted,
            color: keywordFilters.length > 0 ? COLORS.info : COLORS.goldMuted,
          }}>
            {keywordFilters.length > 0 ? `Keywords: ${keywordFilters.length} selected` : "Filter by Keyword"} ▾
          </button>
          {showKeywordDropdown && (
            <div style={{
              position: "absolute", top: "100%", left: 0, zIndex: 50,
              background: COLORS.bgPanel, border: `1px solid ${COLORS.borderSoft}`,
              borderRadius: 8, padding: "8px 0", minWidth: 240,
              maxHeight: 320, overflowY: "auto",
              boxShadow: COLORS.shadowDeep, marginTop: 4,
            }}>
              {keywordFilters.length > 0 && (
                <button onClick={() => setKeywordFilters([])} style={{
                  width: "100%", textAlign: "left", padding: "6px 14px",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: FONTS.serif, fontSize: 12, color: COLORS.danger,
                }}>✕ Clear selection</button>
              )}
              {allMatchedKeywords.length === 0 && (
                <div style={{ padding: "8px 14px", fontSize: 12, color: COLORS.textFaint }}>No keyword matches yet</div>
              )}
              {allMatchedKeywords.map(kw => (
                <label key={kw} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 14px", cursor: "pointer",
                  background: keywordFilters.includes(kw) ? COLORS.goldSoft : "transparent",
                  fontFamily: FONTS.serif, fontSize: 13, color: COLORS.textBody,
                }}>
                  <input type="checkbox" checked={keywordFilters.includes(kw)}
                    onChange={() => toggleKeywordFilter(kw)} style={{ cursor: "pointer" }} />
                  {kw}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: COLORS.textFaint }}>
                    ({articles.filter(a => (a.matched_keywords || []).includes(kw)).length})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {(journalFilter !== "all" || keywordFilters.length > 0 || statusFilter !== "all") && (
          <button onClick={() => { setJournalFilter("all"); setKeywordFilters([]); setStatusFilter("all"); setShowKeywordDropdown(false); }}
            style={{ ...styles.btnDanger, fontSize: 12, padding: "4px 12px" }}>
            ✕ Clear filters
          </button>
        )}

        <div style={{ marginLeft: "auto", fontSize: 12, color: COLORS.textFaint }}>
          {filtered.length} of {articles.length} shown
        </div>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, overflow: "hidden", background: COLORS.bgPanel }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: COLORS.bgPanelDeep }}>
                {[
                  { label: "#", w: 36 },
                  { label: "Status", w: 130 },
                  { label: "Title / Author", w: 280 },
                  { label: "Journal", w: 180 },
                  { label: "Vol", w: 50 },
                  { label: "Issue", w: 50 },
                  { label: "Year", w: 60 },
                  { label: "Keywords", w: 160 },
                  { label: "Actions", w: 120 },
                ].map(h => (
                  <th key={h.label} style={thStyle(h.w)}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: COLORS.textFaint, fontFamily: FONTS.serif }}>
                  No articles match the current filters.
                </td></tr>
              )}
              {filtered.map((art, displayIdx) => {
                const sc = STATUS_STYLE[art.status || "pending"];
                const isEditing = editingId === art.id;
                const isExpanded = expanded === art.id;
                const matches = art.matched_keywords || [];
                return (
                  <Row
                    key={art.id}
                    article={art}
                    displayIdx={displayIdx}
                    statusStyle={sc}
                    isEditing={isEditing}
                    isExpanded={isExpanded}
                    matches={matches}
                    onToggleExpand={() => setExpanded(isExpanded ? null : art.id)}
                    onToggleEdit={() => setEditingId(isEditing ? null : art.id)}
                    onDelete={() => handleDeleteArticle(art.id)}
                    onSetStatus={(status) => setStatus(art.id, status)}
                    onUpdateField={(field, value) => updateField(art.id, field, value)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, color: COLORS.textFaint, fontSize: 12 }}>
        {filtered.length} shown · {articles.length} total · {counts["auto-approved"]} auto-approved · {counts.approved} manually approved · {counts.excluded} excluded · {counts.pending} pending
      </div>
    </div>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

function Row({
  article: art, displayIdx, statusStyle: sc, isEditing, isExpanded, matches,
  onToggleExpand, onToggleEdit, onDelete, onSetStatus, onUpdateField,
}) {
  return (
    <>
      <tr style={{
        background: displayIdx % 2 === 0 ? COLORS.bgPanel : COLORS.bgPanelAlt,
        borderBottom: `1px solid ${COLORS.borderHair}`,
      }}>
        <td style={tdStyle({ width: 36, textAlign: "center", color: COLORS.textFaint, fontSize: 11 })}>{displayIdx + 1}</td>
        <td style={tdStyle({ width: 130 })}>
          <select value={art.status || "pending"} onChange={e => onSetStatus(e.target.value)}
            aria-label="Review status"
            style={{
              background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
              borderRadius: 4, padding: "3px 6px",
              fontFamily: FONTS.serif, fontSize: 11, cursor: "pointer", width: "100%",
            }}>
            <option value="pending">Pending</option>
            <option value="auto-approved">Auto-Approved</option>
            <option value="approved">Approved</option>
            <option value="excluded">Excluded</option>
          </select>
        </td>
        <td style={tdStyle({ width: 280 })}>
          {isEditing
            ? <input value={art.title || ""} onChange={e => onUpdateField("title", e.target.value)} style={cellInput} aria-label="Title" />
            : <div>
                <div style={{ fontWeight: 500, fontSize: 13, color: COLORS.textBody, lineHeight: 1.3 }}>{art.title || "—"}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{art.author || ""}</div>
              </div>}
        </td>
        <td style={tdStyle({ width: 180, fontSize: 12 })}>
          {isEditing ? <input value={art.journal || ""} onChange={e => onUpdateField("journal", e.target.value)} style={cellInput} aria-label="Journal" /> : (art.journal || "")}
        </td>
        <td style={tdStyle({ width: 50, fontSize: 12 })}>
          {isEditing ? <input value={art.volume || ""} onChange={e => onUpdateField("volume", e.target.value)} style={cellInput} aria-label="Volume" /> : (art.volume || "")}
        </td>
        <td style={tdStyle({ width: 50, fontSize: 12 })}>
          {isEditing ? <input value={art.issue || ""} onChange={e => onUpdateField("issue", e.target.value)} style={cellInput} aria-label="Issue" /> : (art.issue || "")}
        </td>
        <td style={tdStyle({ width: 60, fontSize: 12 })}>
          {isEditing ? <input value={art.year || ""} onChange={e => onUpdateField("year", e.target.value)} style={cellInput} aria-label="Year" /> : (art.year || "")}
        </td>
        <td style={tdStyle({ width: 160 })}>
          {matches.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {matches.slice(0, 3).map(kw => (
                <span key={kw} style={{
                  background: "rgba(133,179,212,0.15)", color: COLORS.info,
                  border: `1px solid rgba(133,179,212,0.40)`, borderRadius: 10,
                  padding: "1px 7px", fontSize: 10, whiteSpace: "nowrap",
                }}>{kw}</span>
              ))}
              {matches.length > 3 && <span style={{ fontSize: 10, color: COLORS.info, alignSelf: "center" }}>+{matches.length - 3}</span>}
            </div>
          ) : (
            <span style={{
              background: "rgba(232,181,115,0.15)", color: COLORS.warning,
              border: `1px solid rgba(232,181,115,0.40)`, borderRadius: 10,
              padding: "1px 8px", fontSize: 10,
            }}>⚠ No match</span>
          )}
        </td>
        <td style={tdStyle({ width: 120 })}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onToggleExpand} style={iconBtn(COLORS.info)} aria-label={isExpanded ? "Collapse" : "Expand"}>{isExpanded ? "▲" : "▼"}</button>
            <button onClick={onToggleEdit} style={iconBtn(isEditing ? COLORS.success : COLORS.warning)} aria-label={isEditing ? "Finish editing" : "Edit"}>{isEditing ? "✓" : "Edit"}</button>
            <button onClick={onDelete} style={iconBtn(COLORS.danger)} aria-label="Delete article">✕</button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ background: COLORS.bgPanelDeep, borderBottom: `1px solid ${COLORS.borderHair}` }}>
          <td colSpan={9} style={{ padding: "12px 20px" }}>
            {matches.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.info, marginBottom: 6, fontWeight: 600, letterSpacing: "0.5px" }}>
                  KEYWORD MATCHES ({matches.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {matches.map(kw => (
                    <span key={kw} style={{
                      background: "rgba(133,179,212,0.15)", color: COLORS.info,
                      border: `1px solid rgba(133,179,212,0.40)`, borderRadius: 10,
                      padding: "2px 10px", fontSize: 12,
                    }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>AUTHOR</div>
                {isEditing
                  ? <input value={art.author || ""} onChange={e => onUpdateField("author", e.target.value)} style={{ ...cellInput, width: "100%" }} aria-label="Author" />
                  : <div style={{ fontSize: 13, color: COLORS.textBody }}>{art.author || "—"}</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>LINK</div>
                {isEditing
                  ? <input value={art.link || ""} onChange={e => onUpdateField("link", e.target.value)} style={{ ...cellInput, width: "100%" }} aria-label="Link" />
                  : <a href={art.link || ""} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: COLORS.info, wordBreak: "break-all" }}>{art.link || "—"}</a>}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>ABSTRACT</div>
                {isEditing
                  ? <textarea value={art.abstract || ""} onChange={e => onUpdateField("abstract", e.target.value)}
                      style={{ ...cellInput, width: "100%", minHeight: 80, resize: "vertical" }} aria-label="Abstract" />
                  : <div style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.textBody }}>{art.abstract || "Not available"}</div>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Cell styles ─────────────────────────────────────────────────────────────

function thStyle(width) {
  return {
    padding: "10px 8px",
    color: COLORS.goldMuted,
    fontFamily: FONTS.serif,
    fontSize: 11,
    fontWeight: 600,
    textAlign: "left",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
    borderRight: `1px solid ${COLORS.borderHair}`,
    borderBottom: `2px solid ${COLORS.gold}`,
    background: COLORS.bgPanelDeep,
    width, minWidth: width,
  };
}
function tdStyle(extra = {}) {
  return {
    padding: "8px",
    verticalAlign: "middle",
    borderRight: `1px solid ${COLORS.borderHair}`,
    fontFamily: FONTS.serif,
    color: COLORS.textBody,
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
  width: "100%",
  boxSizing: "border-box",
};
function iconBtn(color) {
  return {
    background: "none",
    border: `1px solid ${color}`,
    color,
    borderRadius: 3,
    padding: "2px 8px",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: FONTS.serif,
  };
}
