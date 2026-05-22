import { useState, useEffect, useMemo } from "react";
import AccessibleGrid from "../lib/AccessibleGrid.jsx";
import { COLORS, FONTS, styles } from "../lib/styles";
import {
  listJournalIssues, addJournalIssue, updateJournalIssue, deleteJournalIssue,
  insertArticles, replaceArticlesForJournalIssue,
} from "../lib/db";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// ─── Stage 1 Phase 1 — Journal template ──────────────────────────────────────

function Phase1({ installmentId, rows, setRows, onAdvanceToPhase2, touchInstallment }) {
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({ tier: "1", journal: "", issn: "", volume: "", issue: "", year: "" });
  const [addError, setAddError] = useState("");

  const filled = rows.filter(r => (r.volume && r.volume.trim()) || (r.issue && r.issue.trim()));
  const filtered = useMemo(
    () => rows.filter(r => !filterText || (r.journal || "").toLowerCase().includes(filterText.toLowerCase())),
    [rows, filterText]
  );

  async function handleCellEdit(row, columnKey, newValue) {
    const patch = {};
    if (columnKey === "tier")    patch.tier    = newValue || null;
    else if (columnKey === "journal") patch.journal = newValue ? newValue.trim() : "";
    else if (columnKey === "issn")    patch.issn    = newValue ? newValue.trim() : null;
    else if (columnKey === "volume")  patch.volume  = newValue ? newValue.trim() : null;
    else if (columnKey === "issue")   patch.issue   = newValue ? newValue.trim() : null;
    else if (columnKey === "year")    patch.year    = newValue ? newValue.trim() : null;
    else return;

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r));
    try {
      const updated = await updateJournalIssue(row.id, patch);
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...updated } : r));
    } catch (err) {
      setRows(prev => prev.map(r => r.id === row.id ? row : r));
      setError(err.message || "Could not save change.");
    }
  }

  async function handleAddRow() {
    if (!newRow.journal.trim()) { setAddError("Journal name is required."); return; }
    setAddError("");
    try {
      const created = await addJournalIssue(installmentId, {
        tier:    newRow.tier    || null,
        journal: newRow.journal.trim(),
        issn:    newRow.issn.trim()    || null,
        volume:  newRow.volume.trim()  || null,
        issue:   newRow.issue.trim()   || null,
        year:    newRow.year.trim()    || null,
      });
      setRows(prev => [...prev, created]);
      setNewRow({ tier: "1", journal: "", issn: "", volume: "", issue: "", year: "" });
      setShowAddRow(false);
      setAnnouncement(`Journal "${created.journal}" added.`);
    } catch (err) {
      setAddError(err.message || "Could not add row.");
    }
  }

  async function handleDelete(row) {
    setConfirmDeleteId(null);
    const prev = rows;
    setRows(p => p.filter(r => r.id !== row.id));
    try {
      await deleteJournalIssue(row.id);
      setAnnouncement(`Row "${row.journal}" removed.`);
    } catch (err) {
      setRows(prev);
      setError(err.message || "Could not delete row.");
    }
  }

  async function handleFetch() {
    const toFetch = rows.filter(r => r.issn && (r.volume || r.issue));
    if (toFetch.length === 0) {
      setError("Please fill in at least one Volume or Issue field before fetching.");
      return;
    }
    setError("");
    setFetching(true);
    setProgress({ done: 0, total: toFetch.length, current: "Starting…" });

    for (let i = 0; i < toFetch.length; i++) {
      const entry = toFetch[i];
      setProgress({ done: i, total: toFetch.length, current: entry.journal });
      try {
        const resp = await fetch(`${BACKEND}/fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issues: [{
              tier: String(entry.tier ?? ""),
              journal: entry.journal,
              issn: entry.issn,
              volume: entry.volume || "",
              issue: entry.issue || "",
              year: entry.year || "",
            }],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const count = data.articles.length;
          if (count > 0) {
            await insertArticles(installmentId, data.articles.map(a => ({ ...a, journal_issue_id: entry.id })));
          }
          await updateJournalIssue(entry.id, {
            fetch_status: count > 0 ? "ok" : "empty",
            fetch_count: count,
          });
          setRows(prev => prev.map(r => r.id === entry.id
            ? { ...r, fetch_status: count > 0 ? "ok" : "empty", fetch_count: count }
            : r));
        } else {
          await updateJournalIssue(entry.id, { fetch_status: "failed", fetch_count: 0 });
          setRows(prev => prev.map(r => r.id === entry.id ? { ...r, fetch_status: "failed", fetch_count: 0 } : r));
        }
      } catch {
        await updateJournalIssue(entry.id, { fetch_status: "failed", fetch_count: 0 });
        setRows(prev => prev.map(r => r.id === entry.id ? { ...r, fetch_status: "failed", fetch_count: 0 } : r));
      }
    }

    setProgress({ done: toFetch.length, total: toFetch.length, current: "Complete!" });
    setFetching(false);
    await touchInstallment();
    onAdvanceToPhase2();
  }

  const columns = useMemo(() => [
    { key: "tier",    label: "Tier",    width: "60px",
      render: r => r.tier || "—",
      editor: { kind: "select", options: [
        { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "", label: "—" },
      ] },
    },
    { key: "journal", label: "Journal", width: "minmax(240px, 2.2fr)",
      render: r => r.journal || "(no name)",
      editor: { kind: "text" },
    },
    { key: "issn",    label: "ISSN",    width: "120px",
      render: r => r.issn || "—",
      editor: { kind: "text" },
    },
    { key: "volume",  label: "Volume",  width: "80px",
      render: r => <span style={{ color: r.volume ? COLORS.success : COLORS.textFaint, fontWeight: r.volume ? 600 : 400 }}>{r.volume || "—"}</span>,
      editor: { kind: "text" },
    },
    { key: "issue",   label: "Issue",   width: "70px",
      render: r => <span style={{ color: r.issue ? COLORS.success : COLORS.textFaint }}>{r.issue || "—"}</span>,
      editor: { kind: "text" },
    },
    { key: "year",    label: "Year",    width: "80px",
      render: r => <span style={{ color: r.year ? COLORS.success : COLORS.textFaint }}>{r.year || "—"}</span>,
      editor: { kind: "text" },
    },
    { key: "_delete", label: "",        width: "50px",
      render: () => <span aria-label="Delete row" style={{
        color: COLORS.danger, width: "100%", textAlign: "center", fontSize: 16,
      }}>✕</span>,
      onActivate: (row) => setConfirmDeleteId(row.id),
    },
  ], []);

  const rowToDelete = confirmDeleteId ? rows.find(r => r.id === confirmDeleteId) : null;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={styles.h2}>Stage 1 — Fetch Articles</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 720 }}>
            Fill in the Volume and/or Issue, and Year columns for the journals you want to include, then click Fetch Articles.
            {filled.length > 0 && <span style={{ color: COLORS.gold, marginLeft: 8 }}>{filled.length} journal{filled.length !== 1 ? "s" : ""} ready to fetch.</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input placeholder="Filter journals…" value={filterText}
            onChange={e => setFilterText(e.target.value)}
            aria-label="Filter journals"
            style={{ ...styles.input, width: 200 }} />
          <button onClick={() => setShowAddRow(s => !s)} style={styles.btnOutline}>+ Add Row</button>
          <button onClick={handleFetch} disabled={fetching || filled.length === 0} style={{
            ...styles.btnPrimary,
            opacity: (fetching || filled.length === 0) ? 0.5 : 1,
            cursor: (fetching || filled.length === 0) ? "default" : "pointer",
          }}>
            {fetching ? "Fetching…" : "Fetch Articles"}
          </button>
        </div>
      </div>

      {error && <div style={styles.banner("error")} role="alert">{error}</div>}

      {showAddRow && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={{ ...styles.h3, marginBottom: 12 }}>Add a journal row</h3>
          {addError && <div style={styles.banner("error")} role="alert">{addError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 130px 90px 90px 90px", gap: 10, marginBottom: 12 }}>
            {[
              { key: "tier",    label: "Tier" },
              { key: "journal", label: "Journal *" },
              { key: "issn",    label: "ISSN" },
              { key: "volume",  label: "Volume" },
              { key: "issue",   label: "Issue" },
              { key: "year",    label: "Year" },
            ].map(f => (
              <div key={f.key}>
                <label style={styles.label}>{f.label}</label>
                <input value={newRow[f.key]} onChange={e => setNewRow(n => ({ ...n, [f.key]: e.target.value }))}
                  style={styles.input} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleAddRow} style={styles.btnPrimary}>Add Row</button>
            <button onClick={() => { setShowAddRow(false); setAddError(""); }} style={styles.btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {fetching && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={{ color: COLORS.gold, marginBottom: 10, fontSize: 14, fontFamily: FONTS.serif }}>
            Fetching from Crossref… {progress.done}/{progress.total}
            {progress.current && <span style={{ color: COLORS.textMuted, marginLeft: 8 }}>— {progress.current}</span>}
          </div>
          <div style={{ background: COLORS.bgPanelDeep, borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{
              background: COLORS.gold, height: "100%", borderRadius: 4,
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      <AccessibleGrid
        ariaLabel="Journal issues template"
        columns={columns}
        rows={filtered}
        rowKey={r => r.id}
        onEdit={handleCellEdit}
        announce={setAnnouncement}
      />

      <p style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 10 }}>
        {rows.length} journals · {filtered.length} shown · {filled.length} with volume filled.
        Press Enter or F2 in a cell to edit. Press Enter on the ✕ column to delete a row.
      </p>

      {rowToDelete && (
        <ConfirmDialog
          title="Remove journal from this installment?"
          body={<><strong style={{ color: COLORS.gold }}>{rowToDelete.journal}</strong> will be removed
            from this installment only. The master journal list is unaffected.</>}
          confirmLabel="Remove"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(rowToDelete)}
        />
      )}
    </div>
  );
}

// ─── Stage 1 Phase 2 — Fetch results ─────────────────────────────────────────

function Phase2({ installmentId, rows, setRows, totalArticleCount, onBack, onProceed }) {
  const [retrying, setRetrying] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  const fetchedRows = rows.filter(r => r.fetch_status);
  const ok     = fetchedRows.filter(r => r.fetch_status === "ok").length;
  const empty  = fetchedRows.filter(r => r.fetch_status === "empty").length;
  const failed = fetchedRows.filter(r => r.fetch_status === "failed").length;

  const filtered = useMemo(
    () => fetchedRows.filter(r => filterStatus === "all" || r.fetch_status === filterStatus),
    [fetchedRows, filterStatus]
  );

  async function retryOne(row) {
    setRetrying(r => ({ ...r, [row.id]: true }));
    try {
      const resp = await fetch(`${BACKEND}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issues: [{
            tier: String(row.tier ?? ""),
            journal: row.journal,
            issn: row.issn,
            volume: row.volume || "",
            issue: row.issue || "",
            year: row.year || "",
          }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = data.articles.length;
        await replaceArticlesForJournalIssue(installmentId, row.id, data.articles);
        await updateJournalIssue(row.id, {
          fetch_status: count > 0 ? "ok" : "empty", fetch_count: count,
        });
        setRows(prev => prev.map(r => r.id === row.id
          ? { ...r, fetch_status: count > 0 ? "ok" : "empty", fetch_count: count }
          : r));
        setAnnouncement(`Retried ${row.journal}: ${count} articles.`);
      } else {
        await updateJournalIssue(row.id, { fetch_status: "failed", fetch_count: 0 });
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, fetch_status: "failed", fetch_count: 0 } : r));
      }
    } catch (err) {
      setError(err.message || "Retry failed.");
    } finally {
      setRetrying(r => ({ ...r, [row.id]: false }));
    }
  }

  async function retryAll() {
    const todo = fetchedRows.filter(r => r.fetch_status === "failed" || r.fetch_status === "empty");
    for (const row of todo) await retryOne(row);
  }

  const statusMeta = {
    ok:     { color: COLORS.success, label: "✓ OK" },
    empty:  { color: COLORS.warning, label: "⚠ Empty" },
    failed: { color: COLORS.danger,  label: "✕ Failed" },
  };

  const columns = useMemo(() => [
    { key: "journal", label: "Journal", width: "minmax(220px, 2fr)",
      render: r => <span style={{ fontStyle: "italic" }}>{r.journal}</span>,
    },
    { key: "issn",    label: "ISSN",    width: "120px",
      render: r => r.issn || "—",
    },
    { key: "volume",  label: "Vol",     width: "60px",
      render: r => <span style={{ color: COLORS.success, fontWeight: 600 }}>{r.volume || "—"}</span>,
      editor: { kind: "text" },
    },
    { key: "issue",   label: "Issue",   width: "60px",
      render: r => <span style={{ color: COLORS.success }}>{r.issue || "—"}</span>,
      editor: { kind: "text" },
    },
    { key: "year",    label: "Year",    width: "70px",
      render: r => <span style={{ color: COLORS.success }}>{r.year || "—"}</span>,
      editor: { kind: "text" },
    },
    { key: "fetch_status", label: "Status", width: "100px",
      render: r => {
        const m = statusMeta[r.fetch_status] || { color: COLORS.textFaint, label: "—" };
        return <span style={{ color: m.color, fontWeight: 600, fontSize: 12 }}>{m.label}</span>;
      },
    },
    { key: "fetch_count", label: "Articles", width: "80px",
      render: r => <span style={{
        color: r.fetch_count > 0 ? COLORS.success : COLORS.textFaint,
        fontWeight: r.fetch_count > 0 ? 600 : 400,
      }}>{r.fetch_count ?? "—"}</span>,
    },
    { key: "_retry", label: "", width: "100px",
      render: r => {
        if (r.fetch_status === "ok") return null;
        if (retrying[r.id]) return <span style={{ color: COLORS.textMuted, fontSize: 12 }}>Retrying…</span>;
        return <span aria-label="Retry fetch" style={{ color: COLORS.gold, fontSize: 12, fontWeight: 600 }}>↺ Retry</span>;
      },
      onActivate: (row) => {
        if (row.fetch_status === "ok") return;
        if (!retrying[row.id]) retryOne(row);
      },
    },
  ], [retrying]);

  async function handleCellEdit(row, columnKey, newValue) {
    const patch = {};
    if (columnKey === "volume") patch.volume = newValue ? newValue.trim() : null;
    else if (columnKey === "issue") patch.issue = newValue ? newValue.trim() : null;
    else if (columnKey === "year")  patch.year  = newValue ? newValue.trim() : null;
    else return;
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r));
    try {
      const updated = await updateJournalIssue(row.id, patch);
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...updated } : r));
    } catch (err) {
      setRows(prev => prev.map(r => r.id === row.id ? row : r));
      setError(err.message || "Could not save.");
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={styles.h2}>Stage 1 — Fetch Results</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 720 }}>
            Check the per-journal results. Retry any that came back Failed or Empty, add any missing journals, then proceed to Review.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onBack} style={styles.btnOutline}>← Edit Journal List</button>
          {(failed > 0 || empty > 0) && (
            <button onClick={retryAll} style={styles.btnOutline}>
              ↺ Retry All Failed/Empty ({failed + empty})
            </button>
          )}
          <button onClick={onProceed} style={styles.btnPrimary}>
            Proceed to Review ({totalArticleCount} articles) →
          </button>
        </div>
      </div>

      {error && <div style={styles.banner("error")} role="alert">{error}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { key: "all",    label: `All (${fetchedRows.length})`, color: COLORS.goldMuted },
          { key: "ok",     label: `✓ OK (${ok})`,                color: COLORS.success },
          { key: "empty",  label: `⚠ Empty (${empty})`,          color: COLORS.warning },
          { key: "failed", label: `✕ Failed (${failed})`,        color: COLORS.danger },
        ].map(s => {
          const active = filterStatus === s.key;
          return (
            <button key={s.key} onClick={() => setFilterStatus(s.key)} style={{
              padding: "5px 14px", borderRadius: 20,
              fontFamily: FONTS.serif, fontSize: 12, cursor: "pointer",
              border: `1px solid ${active ? s.color : COLORS.borderSoft}`,
              background: active ? COLORS.goldSoft : "transparent",
              color: active ? s.color : COLORS.textMuted,
              fontWeight: active ? 600 : 400,
            }}>{s.label}</button>
          );
        })}
        <div style={{ marginLeft: "auto", color: COLORS.textFaint, fontSize: 12 }}>
          {totalArticleCount} articles fetched total
        </div>
      </div>

      <AccessibleGrid
        ariaLabel="Fetch results"
        columns={columns}
        rows={filtered}
        rowKey={r => r.id}
        onEdit={handleCellEdit}
        announce={setAnnouncement}
      />

      <p style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 10 }}>
        Use the Retry column to refetch a single row. Edit Volume / Issue / Year inline before retrying if the issue you wanted is different.
      </p>
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stage1-confirm-title"
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
        <h2 id="stage1-confirm-title" style={{
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

// ─── Stage 1 orchestrator ────────────────────────────────────────────────────

export default function Stage1({ installment, goToStage, touchInstallment }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [forcePhase1, setForcePhase1] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await listJournalIssues(installment.id);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load journal issues.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [installment.id]);

  const anyFetched = rows.some(r => r.fetch_status);
  const totalArticleCount = rows.reduce((n, r) => n + (r.fetch_count || 0), 0);
  const inPhase2 = anyFetched && !forcePhase1;

  if (loading) return <CenteredLoader>Loading journal issues…</CenteredLoader>;
  if (loadError) return <CenteredError>{loadError}</CenteredError>;

  if (inPhase2) {
    return (
      <Phase2
        installmentId={installment.id}
        rows={rows}
        setRows={setRows}
        totalArticleCount={totalArticleCount}
        onBack={() => setForcePhase1(true)}
        onProceed={() => goToStage(2)}
      />
    );
  }

  return (
    <Phase1
      installmentId={installment.id}
      rows={rows}
      setRows={setRows}
      onAdvanceToPhase2={() => setForcePhase1(false)}
      touchInstallment={touchInstallment}
    />
  );
}

function CenteredLoader({ children }) {
  return (
    <div style={{
      padding: 80, textAlign: "center", color: COLORS.textMuted,
      fontFamily: FONTS.serif,
    }}>{children}</div>
  );
}

function CenteredError({ children }) {
  return (
    <div style={{ padding: 80, textAlign: "center", fontFamily: FONTS.serif }}>
      <div style={{ color: COLORS.danger, marginBottom: 12 }}>{children}</div>
      <button onClick={() => window.location.reload()} style={styles.btnOutline}>Reload</button>
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
