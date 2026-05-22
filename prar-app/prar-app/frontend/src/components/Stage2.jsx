import { useState, useEffect, useMemo } from "react";
import AccessibleGrid from "../lib/AccessibleGrid.jsx";
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

const STATUS_STYLE = {
  pending:         { color: COLORS.warning, bg: "rgba(232,181,115,0.10)", border: "rgba(232,181,115,0.40)" },
  approved:        { color: COLORS.success, bg: "rgba(124,191,153,0.10)", border: "rgba(124,191,153,0.40)" },
  "auto-approved": { color: COLORS.info,    bg: "rgba(133,179,212,0.10)", border: "rgba(133,179,212,0.40)" },
  excluded:        { color: COLORS.danger,  bg: "rgba(224,124,124,0.10)", border: "rgba(224,124,124,0.40)" },
};

const STATUS_OPTIONS = [
  { value: "pending",       label: "Pending" },
  { value: "auto-approved", label: "Auto-Approved" },
  { value: "approved",      label: "Approved" },
  { value: "excluded",      label: "Excluded" },
];

function getMatches(article, keywords) {
  const haystack = [article.title || "", article.abstract || "", article.journal || ""].join(" ").toLowerCase();
  return keywords.filter(kw => haystack.includes(kw.toLowerCase()));
}

export default function Stage2({ installment, goToStage }) {
  const [articles, setArticles] = useState([]);
  const [keywordRows, setKeywordRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [journalFilter, setJournalFilter] = useState("all");
  const [keywordFilters, setKeywordFilters] = useState([]);
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  const keywords = useMemo(() => keywordRows.map(k => k.keyword), [keywordRows]);

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

        let useKws = kws;
        if (kws.length === 0) {
          useKws = await replaceKeywordsForInstallment(installment.id, DEFAULT_KEYWORDS);
        }
        const kwList = useKws.map(k => k.keyword);

        const updatesToPersist = [];
        const withMatches = arts.map(a => {
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
            updatesToPersist.push({ id: a.id, status: nextStatus, matched_keywords: matches });
          }
          return { ...a, status: nextStatus, matched_keywords: matches };
        });

        setArticles(withMatches);
        setKeywordRows(useKws);

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

  async function handleCellEdit(row, columnKey, newValue) {
    // Compute the patch.
    const patch = {};
    if (columnKey === "status") patch.status = newValue;
    else if (["title", "abstract", "journal", "author", "link", "volume", "issue", "year"].includes(columnKey)) {
      patch[columnKey] = newValue;
    } else return;

    // If the edit affects match input, recompute matched_keywords on top of the patch.
    if (["title", "abstract", "journal"].includes(columnKey)) {
      const next = { ...row, ...patch };
      patch.matched_keywords = getMatches(next, keywords);
    }

    setArticles(prev => prev.map(a => a.id === row.id ? { ...a, ...patch } : a));
    try {
      await updateArticle(row.id, patch);
    } catch (err) {
      setArticles(prev => prev.map(a => a.id === row.id ? row : a));
      setError(err.message || "Could not save change.");
    }
  }

  async function handleDeleteArticle(id) {
    setConfirmDeleteId(null);
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
    goToStage(3);
  }

  const approvedCount = counts.approved + counts["auto-approved"];

  // ─── Grid columns ───────────────────────────────────────────────────────

  const columns = useMemo(() => [
    {
      key: "status",
      label: "Status",
      width: "130px",
      render: r => {
        const sc = STATUS_STYLE[r.status || "pending"];
        const label = (r.status || "pending") === "auto-approved" ? "Auto-Approved"
          : ((r.status || "pending").charAt(0).toUpperCase() + (r.status || "pending").slice(1));
        return (
          <span style={{
            background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
            borderRadius: 4, padding: "1px 8px",
            fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          }}>{label}</span>
        );
      },
      editor: { kind: "select", options: STATUS_OPTIONS },
    },
    {
      key: "title",
      label: "Title",
      width: "minmax(220px, 2.5fr)",
      render: r => (
        <span title={r.title || ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {r.title || "—"}
        </span>
      ),
      editor: { kind: "text" },
    },
    {
      key: "author",
      label: "Author",
      width: "minmax(120px, 1.2fr)",
      render: r => r.author || "—",
      editor: { kind: "text" },
    },
    {
      key: "journal",
      label: "Journal",
      width: "minmax(140px, 1.4fr)",
      render: r => <span style={{ fontStyle: "italic" }}>{r.journal || "—"}</span>,
      editor: { kind: "text" },
    },
    {
      key: "volume",
      label: "Vol",
      width: "55px",
      render: r => r.volume || "—",
      editor: { kind: "text" },
    },
    {
      key: "issue",
      label: "Issue",
      width: "55px",
      render: r => r.issue || "—",
      editor: { kind: "text" },
    },
    {
      key: "year",
      label: "Year",
      width: "65px",
      render: r => r.year || "—",
      editor: { kind: "text" },
    },
    {
      key: "matched_keywords",
      label: "Keywords",
      width: "minmax(140px, 1.2fr)",
      render: r => {
        const matches = r.matched_keywords || [];
        if (matches.length === 0) {
          return (
            <span style={{
              background: "rgba(232,181,115,0.15)", color: COLORS.warning,
              border: `1px solid rgba(232,181,115,0.40)`, borderRadius: 10,
              padding: "1px 8px", fontSize: 10, whiteSpace: "nowrap",
            }}>⚠ No match</span>
          );
        }
        return (
          <span style={{ display: "inline-flex", gap: 3, flexWrap: "nowrap", overflow: "hidden" }}>
            {matches.slice(0, 2).map(kw => (
              <span key={kw} style={{
                background: "rgba(133,179,212,0.15)", color: COLORS.info,
                border: `1px solid rgba(133,179,212,0.40)`, borderRadius: 10,
                padding: "1px 7px", fontSize: 10, whiteSpace: "nowrap",
              }}>{kw}</span>
            ))}
            {matches.length > 2 && (
              <span style={{ fontSize: 10, color: COLORS.info, alignSelf: "center" }}>+{matches.length - 2}</span>
            )}
          </span>
        );
      },
    },
    {
      key: "_delete",
      label: "",
      width: "44px",
      render: () => (
        <span aria-label="Delete article" style={{
          color: COLORS.danger, width: "100%", textAlign: "center", fontSize: 14,
        }}>✕</span>
      ),
      onActivate: (row) => setConfirmDeleteId(row.id),
    },
  ], []);

  function renderExpanded(art) {
    const matches = art.matched_keywords || [];
    return (
      <div>
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
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>LINK</div>
            <a href={art.link || ""} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: COLORS.info, wordBreak: "break-all" }}>
              {art.link || "—"}
            </a>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>DOI</div>
            <div style={{ fontSize: 13, color: COLORS.textBody }}>{art.doi || "—"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>ABSTRACT</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.textBody }}>
              {art.abstract || <em style={{ color: COLORS.textFaint }}>Not available</em>}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  const articleToDelete = confirmDeleteId ? articles.find(a => a.id === confirmDeleteId) : null;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300, margin: "0 auto" }}>
      <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

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

      {/* Review progress bar */}
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

      {/* Keyword management panel */}
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

      {/* The grid */}
      <AccessibleGrid
        ariaLabel="Articles to review"
        columns={columns}
        rows={filtered}
        rowKey={r => r.id}
        onEdit={handleCellEdit}
        renderExpanded={renderExpanded}
        announce={setAnnouncement}
      />

      <p style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 10 }}>
        Press Enter or F2 in a cell to edit. Enter on the first column expands the row to show abstract, link, and DOI.
        Enter on the ✕ column deletes an article. Status changes save instantly.
      </p>

      {articleToDelete && (
        <ConfirmDialog
          title="Delete article?"
          body={<><strong style={{ color: COLORS.gold }}>{articleToDelete.title || "(no title)"}</strong> will be
            permanently removed from this installment. This cannot be undone.</>}
          confirmLabel="Delete article"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDeleteArticle(articleToDelete.id)}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stage2-confirm-title"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "grid", placeItems: "center", padding: 24, zIndex: 300,
      }}>
      <div style={{
        background: COLORS.bgPanel, borderRadius: 10, padding: "24px 28px",
        maxWidth: 460, width: "100%", boxShadow: COLORS.shadowDeep,
        border: `1px solid ${COLORS.borderSoft}`,
      }}>
        <h2 id="stage2-confirm-title" style={{
          fontFamily: FONTS.display, fontSize: 20, fontWeight: 500,
          margin: "0 0 8px", color: COLORS.gold,
        }}>{title}</h2>
        <p style={{ color: COLORS.textBody, fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={styles.btnOutline} autoFocus>Cancel</button>
          <button onClick={onConfirm} style={styles.btnDanger}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const srOnly = {
  position: "absolute",
  width: 1, height: 1,
  padding: 0, margin: -1, overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap", border: 0,
};
