import { useState, useEffect, useMemo } from "react";
import AccessibleGrid from "../lib/AccessibleGrid.jsx";
import { PART_MAP, PART_COLORS } from "../data";
import { COLORS, FONTS, styles } from "../lib/styles";
import { listArticles, updateArticle, deleteArticle } from "../lib/db";

const PARTS = ["All Articles", "Part 1", "Part 2", "Part 3", "Part 4"];

function ensurePart(a) {
  if (a.part) return a;
  return { ...a, part: PART_MAP[(a.journal || "").trim()] || "" };
}

const PART_OPTIONS = [
  { value: "", label: "—" },
  { value: "Part 1", label: "Part 1" },
  { value: "Part 2", label: "Part 2" },
  { value: "Part 3", label: "Part 3" },
  { value: "Part 4", label: "Part 4" },
];

export default function Stage3({ installment, goToStage }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("All Articles");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await listArticles(installment.id);
        const approved = all
          .filter(a => a.status === "approved" || a.status === "auto-approved")
          .map(ensurePart);
        const needPart = approved.filter(a => {
          const wasMissing = !all.find(o => o.id === a.id)?.part;
          return wasMissing && a.part;
        });
        if (!cancelled) setArticles(approved);
        if (needPart.length > 0) {
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

  async function handleCellEdit(row, columnKey, newValue) {
    const patch = {};
    if (columnKey === "part") {
      patch.part = newValue || null;
    } else if (["journal", "title", "author", "volume", "issue", "year", "tier", "abstract"].includes(columnKey)) {
      patch[columnKey] = newValue;
    } else return;

    // If journal changed, recompute the suggested part (only if part is empty
    // — don't override an explicit user choice).
    if (columnKey === "journal" && !row.part) {
      patch.part = PART_MAP[(newValue || "").trim()] || null;
    }

    setArticles(prev => prev.map(a => a.id === row.id ? { ...a, ...patch } : a));
    try {
      await updateArticle(row.id, patch);
    } catch (err) {
      setArticles(prev => prev.map(a => a.id === row.id ? row : a));
      setError(err.message || "Could not save change.");
    }
  }

  async function handleDelete(id) {
    setConfirmDeleteId(null);
    const prev = articles;
    setArticles(prev.filter(a => a.id !== id));
    try { await deleteArticle(id); }
    catch (err) { setArticles(prev); setError(err.message || "Could not delete article."); }
  }

  const counts = useMemo(() => {
    const out = {};
    for (const p of PARTS.slice(1)) out[p] = articles.filter(a => a.part === p).length;
    return out;
  }, [articles]);
  const unassigned = articles.filter(a => !a.part || !PARTS.includes(a.part)).length;

  const tabArticles = activeTab === "All Articles"
    ? articles
    : articles.filter(a => a.part === activeTab);

  const sorted = useMemo(
    () => [...tabArticles].sort((a, b) => (a.journal || "").localeCompare(b.journal || "")),
    [tabArticles]
  );

  // ─── Columns ────────────────────────────────────────────────────────────

  const columns = useMemo(() => [
    {
      key: "journal",
      label: "Journal",
      width: "minmax(180px, 2fr)",
      render: r => <span style={{ fontStyle: "italic", color: COLORS.gold }}>{r.journal || "—"}</span>,
      editor: { kind: "text" },
    },
    {
      key: "title",
      label: "Title",
      width: "minmax(220px, 2.5fr)",
      render: r => (
        <span title={r.title || ""}>{r.title || "—"}</span>
      ),
      editor: { kind: "text" },
    },
    {
      key: "author",
      label: "Author",
      width: "minmax(120px, 1.4fr)",
      render: r => r.author || "—",
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
      key: "tier",
      label: "Tier",
      width: "55px",
      render: r => r.tier || "—",
      editor: { kind: "text" },
    },
    {
      key: "part",
      label: "Part",
      width: "100px",
      render: r => {
        const pc = PART_COLORS[r.part];
        if (!pc) return <span style={{ color: COLORS.textFaint, fontSize: 12 }}>—</span>;
        return (
          <span style={{
            color: pc.text, fontWeight: 600, fontSize: 11,
            background: pc.bg, padding: "2px 8px", borderRadius: 10,
            border: `1px solid ${pc.border}`, whiteSpace: "nowrap",
          }}>{r.part}</span>
        );
      },
      editor: { kind: "select", options: PART_OPTIONS },
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
    return (
      <div>
        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.5px" }}>ABSTRACT</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.textBody }}>
          {art.abstract || <em style={{ color: COLORS.textFaint }}>Not available</em>}
        </div>
      </div>
    );
  }

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

  const articleToDelete = confirmDeleteId ? articles.find(a => a.id === confirmDeleteId) : null;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>
      <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={styles.h2}>Stage 3 — Compile</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 760 }}>
            Articles are auto-assigned to Parts based on their journal — this is a suggestion.
            Reassign via the Part column to balance counts across the four parts and group similar-subject journals together.
          </p>
        </div>
        <button onClick={() => goToStage(4)} style={styles.btnPrimary}>
          Proceed to Generate →
        </button>
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
      <div style={{ display: "flex", borderBottom: `2px solid ${COLORS.borderSoft}`, marginBottom: 10, flexWrap: "wrap" }}>
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

      <AccessibleGrid
        ariaLabel="Approved articles by part"
        columns={columns}
        rows={sorted}
        rowKey={r => r.id}
        onEdit={handleCellEdit}
        renderExpanded={renderExpanded}
        announce={setAnnouncement}
      />

      <p style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 10 }}>
        {sorted.length} articles shown. Press Enter or F2 in a cell to edit. Enter on the first column expands the row to show the abstract.
      </p>

      {articleToDelete && (
        <ConfirmDialog
          title="Delete article?"
          body={<><strong style={{ color: COLORS.gold }}>{articleToDelete.title || "(no title)"}</strong> will be
            permanently removed from this installment. This cannot be undone.</>}
          confirmLabel="Delete article"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(articleToDelete.id)}
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
    <div role="dialog" aria-modal="true" aria-labelledby="stage3-confirm-title"
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
        <h2 id="stage3-confirm-title" style={{
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

function summaryCard(border, text, bg) {
  return {
    background: bg, border: `1px solid ${border}`, borderRadius: 8,
    padding: "10px 20px", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 2, color: text,
    fontFamily: FONTS.serif, minWidth: 90,
  };
}

const srOnly = {
  position: "absolute",
  width: 1, height: 1,
  padding: 0, margin: -1, overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap", border: 0,
};
