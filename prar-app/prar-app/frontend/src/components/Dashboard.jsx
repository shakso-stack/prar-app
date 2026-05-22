import { useState, useMemo, useEffect, useCallback } from "react";
import AccessibleGrid from "../lib/AccessibleGrid.jsx";
import AddJournalModal from "./AddJournalModal.jsx";
import BackupImportModal from "./BackupModal.jsx";
import { COLORS, FONTS, styles } from "../lib/styles";
import { formatDate, ORDINALS } from "../lib/util";
import {
  addMasterJournal,
  updateMasterJournal,
  deleteMasterJournal,
  createInstallment,
  deleteInstallment,
  getInstallmentStatsMap,
} from "../lib/db";
import { exportInstallment, downloadAsJsonFile } from "../lib/backup";

const STAGE_STEPS = [
  { n: 1, label: "Fetch" }, { n: 2, label: "Review" }, { n: 3, label: "Compile" },
  { n: 4, label: "Generate" }, { n: 5, label: "Download" },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStage }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {STAGE_STEPS.map((step, i) => {
          const done = currentStage > step.n;
          const active = currentStage === step.n;
          return (
            <div key={step.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              {i > 0 && <div style={{ height: 2, flex: 1, background: done || active ? COLORS.gold : COLORS.borderHair, transition: "background 0.3s" }} />}
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, fontFamily: FONTS.serif,
                background: done ? COLORS.gold : active ? COLORS.bgPanelDeep : "transparent",
                border: done ? `2px solid ${COLORS.gold}` : active ? `2px solid ${COLORS.gold}` : `2px solid ${COLORS.borderSoft}`,
                color: done ? COLORS.textOnGold : active ? COLORS.gold : COLORS.textFaint,
                position: "relative",
                transition: "all 0.2s ease",
              }}>
                {done ? "✓" : step.n}
                <div style={{ position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)", fontSize: 10, whiteSpace: "nowrap", color: done || active ? COLORS.goldMuted : COLORS.textFaint, fontWeight: active ? 600 : 400, letterSpacing: "0.4px" }}>
                  {step.label}
                </div>
              </div>
              {i < STAGE_STEPS.length - 1 && <div style={{ height: 2, flex: 1, background: done ? COLORS.gold : COLORS.borderHair, transition: "background 0.3s" }} />}
            </div>
          );
        })}
      </div>
      <div style={{ height: 18 }} />
    </div>
  );
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortMasterJournals(rows) {
  return [...rows].sort((a, b) => {
    const ta = a.tier == null || a.tier === "" ? Infinity : Number(a.tier);
    const tb = b.tier == null || b.tier === "" ? Infinity : Number(b.tier);
    const taSafe = Number.isFinite(ta) ? ta : Infinity;
    const tbSafe = Number.isFinite(tb) ? tb : Infinity;
    if (taSafe !== tbSafe) return taSafe - tbSafe;
    const ja = (a.journal || "").toLowerCase();
    const jb = (b.journal || "").toLowerCase();
    return ja.localeCompare(jb);
  });
}

// ─── Manage Journal List Panel ────────────────────────────────────────────────

function ManageJournals({ masterJournals, setMasterJournals, onClose }) {
  const [filterText, setFilterText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  const sorted = useMemo(() => sortMasterJournals(masterJournals), [masterJournals]);

  const filtered = useMemo(() => {
    if (!filterText) return sorted;
    const q = filterText.toLowerCase();
    return sorted.filter(r =>
      (r.journal || "").toLowerCase().includes(q) ||
      (r.issn || "").toLowerCase().includes(q)
    );
  }, [sorted, filterText]);

  const existingIssns = useMemo(
    () => new Set(masterJournals.map(j => (j.issn || "").toLowerCase()).filter(Boolean)),
    [masterJournals]
  );

  function flashRow(id) {
    setHighlightId(id);
    setTimeout(() => {
      setHighlightId(curr => curr === id ? null : curr);
    }, 1500);
  }

  async function handleCellEdit(row, columnKey, newValue) {
    setError("");
    const patch = {};
    if (columnKey === "tier") patch.tier = newValue || null;
    else if (columnKey === "journal") patch.journal = newValue ? newValue.trim() : "";
    else if (columnKey === "issn") patch.issn = newValue ? newValue.trim() : null;
    else return;

    setMasterJournals(prev => prev.map(j => j.id === row.id ? { ...j, ...patch } : j));
    flashRow(row.id);

    try {
      const updated = await updateMasterJournal(row.id, patch);
      setMasterJournals(prev => prev.map(j => j.id === row.id ? { ...j, ...updated } : j));
    } catch (err) {
      setMasterJournals(prev => prev.map(j => j.id === row.id ? row : j));
      setError(err.message || "Could not save change.");
    }
  }

  async function handleAddJournal({ tier, journal, issn }) {
    setError("");
    const created = await addMasterJournal({ tier, journal, issn });
    setMasterJournals(prev => [...prev, created]);
    setShowAddModal(false);
    setAnnouncement(`Journal "${created.journal}" added.`);
    flashRow(created.id);
  }

  async function handleDelete(row) {
    setError("");
    setConfirmDeleteId(null);
    const previous = masterJournals;
    setMasterJournals(prev => prev.filter(j => j.id !== row.id));
    try {
      await deleteMasterJournal(row.id);
      setAnnouncement(`Journal "${row.journal}" removed.`);
    } catch (err) {
      setMasterJournals(previous);
      setError(err.message || "Could not delete journal.");
    }
  }

  const columns = useMemo(() => [
    {
      key: "tier",
      label: "Tier",
      width: "70px",
      render: r => r.tier || "—",
      editor: { kind: "select", options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ] },
    },
    {
      key: "journal",
      label: "Journal",
      width: "minmax(280px, 2.5fr)",
      render: r => r.journal || "(no name)",
      editor: { kind: "text" },
    },
    {
      key: "issn",
      label: "ISSN",
      width: "140px",
      render: r => r.issn || "—",
      editor: { kind: "text" },
    },
    {
      key: "_delete",
      label: "",
      width: "60px",
      render: () => (
        <span aria-label="Delete journal" style={{
          color: COLORS.danger,
          width: "100%",
          textAlign: "center",
          fontSize: 16,
        }}>✕</span>
      ),
      onActivate: (row) => setConfirmDeleteId(row.id),
    },
  ], []);

  const rowToDelete = confirmDeleteId
    ? masterJournals.find(j => j.id === confirmDeleteId)
    : null;

  return (
    <div style={{ ...styles.card, marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ ...styles.h3, marginBottom: 4 }}>Manage Journal List</h3>
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: 0 }}>
            Edits save automatically. The list is sorted by tier, then alphabetically by journal name.
            Changes apply to all <em>new</em> installments — existing installments are unaffected.
          </p>
        </div>
        <button onClick={onClose} style={styles.btnSubtle}>✕ Close</button>
      </div>

      <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

      {error && (
        <div style={styles.banner("error")} role="alert">
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <input
          placeholder="Filter by journal or ISSN…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={{ ...styles.input, width: 280 }}
          aria-label="Filter journal list"
        />
        <button onClick={() => setShowAddModal(true)} style={styles.btnOutline}>
          + Add Journal
        </button>
        <div style={{ marginLeft: "auto", color: COLORS.textFaint, fontSize: 12 }}>
          {masterJournals.length} journal{masterJournals.length === 1 ? "" : "s"}
          {filterText && ` · ${filtered.length} shown`}
        </div>
      </div>

      <AccessibleGrid
        ariaLabel="Master journal list"
        columns={columns}
        rows={filtered}
        rowKey={r => r.id}
        onEdit={handleCellEdit}
        announce={msg => setAnnouncement(msg)}
        highlightRow={highlightId}
      />

      <p style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 10, marginBottom: 0 }}>
        Press Enter or F2 in a cell to edit. Press Enter on the ✕ column to delete a row.
      </p>

      {showAddModal && (
        <AddJournalModal
          existingIssns={existingIssns}
          onCancel={() => setShowAddModal(false)}
          onSave={handleAddJournal}
        />
      )}

      {rowToDelete && (
        <ConfirmDialog
          title="Remove journal?"
          body={<><strong style={{ color: COLORS.gold }}>{rowToDelete.journal}</strong> will be removed
            from the master list. Existing installments are unaffected. This action cannot
            be undone.</>}
          confirmLabel="Remove journal"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(rowToDelete)}
        />
      )}
    </div>
  );
}

// ─── Generic confirm dialog ──────────────────────────────────────────────────

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "grid", placeItems: "center",
        padding: 24, zIndex: 300,
      }}
    >
      <div style={{
        background: COLORS.bgPanel,
        borderRadius: 10,
        padding: "24px 28px",
        maxWidth: 460,
        width: "100%",
        boxShadow: COLORS.shadowDeep,
        border: `1px solid ${COLORS.borderSoft}`,
      }}>
        <h2 id="confirm-dialog-title" style={{
          fontFamily: FONTS.display,
          fontSize: 20, fontWeight: 500,
          margin: "0 0 8px", color: COLORS.gold,
        }}>{title}</h2>
        <p style={{ color: COLORS.textBody, fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
          {body}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={styles.btnOutline} autoFocus>Cancel</button>
          <button onClick={onConfirm} style={styles.btnDanger}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({
  installments, setInstallments,
  masterJournals, setMasterJournals,
  userId, onCreated, onDeleted, onOpen,
}) {
  const [showNew, setShowNew] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [form, setForm] = useState({ name: "", installmentNumber: "", seasonYear: "" });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState({});
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const [exportError, setExportError] = useState("");

  // Load per-installment stats once on mount. Cheap enough we don't bother
  // re-loading on every change; new installments start at 0 articles.
  useEffect(() => {
    let cancelled = false;
    getInstallmentStatsMap()
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const s = await getInstallmentStatsMap();
      setStats(s);
    } catch { /* non-fatal */ }
  }, []);

  async function handleCreate() {
    if (!form.name.trim()) return setError("Please enter a name for this installment.");
    if (!form.installmentNumber || isNaN(parseInt(form.installmentNumber)))
      return setError("Please enter a valid installment number.");
    if (!form.seasonYear.trim()) return setError("Please enter a season/year (e.g. Fall 2024).");
    setError("");
    setCreating(true);
    try {
      const inst = await createInstallment({
        name: form.name.trim(),
        installmentNumber: parseInt(form.installmentNumber),
        seasonYear: form.seasonYear.trim(),
        userId,
      });
      setShowNew(false);
      setForm({ name: "", installmentNumber: "", seasonYear: "" });
      onCreated(inst);
    } catch (err) {
      setError(err.message || "Could not create installment.");
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await deleteInstallment(id);
      onDeleted(id);
      refreshStats();
    } catch (err) {
      alert(err.message || "Could not delete installment.");
    }
  }

  async function handleExport(installment) {
    setExportError("");
    setExportingId(installment.id);
    try {
      const data = await exportInstallment(installment.id);
      const safeName = installment.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
      downloadAsJsonFile(data, `${safeName}_backup.json`);
    } catch (err) {
      setExportError(err.message || "Could not export installment.");
    } finally {
      setExportingId(null);
    }
  }

  function handleImported(installment) {
    setShowImport(false);
    onCreated(installment);
    refreshStats();
  }

  const installmentToDelete = pendingDeleteId
    ? installments.find(i => i.id === pendingDeleteId)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bgPage, fontFamily: FONTS.serif }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 320, overflow: "hidden" }}>
        <img src="/hero.png" alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.55) saturate(0.9)" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(24,18,14,0.35), ${COLORS.bgPage} 95%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 36 }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: COLORS.gold, textTransform: "uppercase", marginBottom: 10, opacity: 0.85 }}>Periodic Review Tool</div>
          <h1 style={{ fontSize: 40, color: COLORS.textBody, fontFamily: FONTS.display, fontWeight: 500, margin: 0, textAlign: "center", letterSpacing: 0.5, textShadow: "0 2px 16px rgba(0,0,0,0.65)" }}>
            Peer-Reviewed Articles Review
          </h1>
          <div style={{ width: 80, height: 2, background: COLORS.gold, margin: "16px auto 0" }} />
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ ...styles.h2, margin: 0 }}>PRAR Installments</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowManage(s => !s)} style={{
              ...styles.btnOutline,
              borderColor: showManage ? COLORS.gold : COLORS.goldMuted,
              color: showManage ? COLORS.gold : COLORS.goldMuted,
            }}>
              ⚙ Manage Journal List
            </button>
            <button onClick={() => setShowImport(true)} style={styles.btnOutline}>
              ↑ Import Backup
            </button>
            <button onClick={() => { setShowNew(true); setError(""); setForm({ name: "", installmentNumber: "", seasonYear: "" }); }}
              style={styles.btnPrimary}>
              + New PRAR Installment
            </button>
          </div>
        </div>

        {showManage && (
          <ManageJournals
            masterJournals={masterJournals}
            setMasterJournals={setMasterJournals}
            onClose={() => setShowManage(false)}
          />
        )}

        {showNew && (
          <div style={{ ...styles.card, marginBottom: 28 }}>
            <h3 style={styles.h3}>New PRAR Installment</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label htmlFor="new-name" style={styles.label}>Installment Name</label>
                <input id="new-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PRAR Installment 27" style={styles.input} />
              </div>
              <div>
                <label htmlFor="new-number" style={styles.label}>Installment Number</label>
                <input id="new-number" value={form.installmentNumber} onChange={e => setForm(f => ({ ...f, installmentNumber: e.target.value }))} placeholder="e.g. 27" type="number" min="1" style={styles.input} />
              </div>
              <div>
                <label htmlFor="new-season" style={styles.label}>Season / Year</label>
                <input id="new-season" value={form.seasonYear} onChange={e => setForm(f => ({ ...f, seasonYear: e.target.value }))} placeholder="e.g. Fall 2024" style={styles.input} />
              </div>
            </div>
            {form.installmentNumber && ORDINALS[parseInt(form.installmentNumber)] && (
              <div style={{ color: COLORS.goldMuted, fontSize: 13, marginBottom: 12 }}>
                Preview intro word: "<em>{ORDINALS[parseInt(form.installmentNumber)]}</em>" · Using master list with {masterJournals.length} journals
              </div>
            )}
            {error && <div style={styles.banner("error")} role="alert">{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCreate} disabled={creating} style={{
                ...styles.btnPrimary,
                opacity: creating ? 0.6 : 1,
                cursor: creating ? "default" : "pointer",
              }}>{creating ? "Creating…" : "Create & Open"}</button>
              <button onClick={() => setShowNew(false)} style={styles.btnOutline}>Cancel</button>
            </div>
          </div>
        )}

        {installments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.textFaint, fontSize: 16 }}>
            No installments yet. Create your first PRAR Installment to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {installments.map(inst => {
              const s = stats[inst.id] || { total: 0, reviewed: 0, approved: 0 };
              const reviewPct = s.total > 0 ? Math.round((s.reviewed / s.total) * 100) : 0;
              return (
                <div key={inst.id} style={{
                  ...styles.card,
                  marginBottom: 0,
                  padding: "18px 22px",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.boxShadow = COLORS.shadowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.borderSoft; e.currentTarget.style.boxShadow = COLORS.shadowSoft; }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ color: COLORS.textBody, fontSize: 17, fontWeight: 500, marginBottom: 4 }}>{inst.name}</div>
                      <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
                        {inst.season_year} · Installment #{inst.installment_number}
                        {s.total > 0 && ` · ${s.total} articles`}
                        {inst.stage >= 2 && s.total > 0 && ` · ${reviewPct}% reviewed`}
                        {" · "}Last edited {formatDate(inst.updated_at)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      <button onClick={() => handleExport(inst)}
                        disabled={exportingId === inst.id}
                        title="Download installment as JSON backup"
                        style={{ ...btnSmall(styles.btnSubtle), opacity: exportingId === inst.id ? 0.5 : 1 }}>
                        {exportingId === inst.id ? "Exporting…" : "↓ Export"}
                      </button>
                      <button onClick={() => setPendingDeleteId(inst.id)} style={btnSmall(styles.btnDanger)}>Delete</button>
                      <button onClick={() => onOpen(inst.id)} style={btnSmall(styles.btnPrimary)}>Open →</button>
                    </div>
                  </div>
                  <ProgressBar currentStage={inst.stage || 1} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {installmentToDelete && (
        <ConfirmDialog
          title="Delete installment?"
          body={<><strong style={{ color: COLORS.gold }}>{installmentToDelete.name}</strong> will be
            permanently deleted, along with all of its journal issues, articles, and keywords. This
            action cannot be undone.</>}
          confirmLabel="Delete installment"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showImport && (
        <BackupImportModal
          userId={userId}
          onCancel={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {exportError && (
        <div role="alert" style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 200,
          maxWidth: 400, padding: "12px 16px",
          background: COLORS.bgPanel, border: `1px solid ${COLORS.danger}`,
          borderLeft: `4px solid ${COLORS.danger}`,
          borderRadius: 5, color: COLORS.danger,
          fontFamily: FONTS.serif, fontSize: 13,
          boxShadow: COLORS.shadowDeep,
        }}>
          <strong>Export failed: </strong>{exportError}
          <button onClick={() => setExportError("")} style={{
            background: "none", border: "none", color: COLORS.danger,
            cursor: "pointer", marginLeft: 8, fontSize: 18, lineHeight: 1, padding: 0,
          }} aria-label="Dismiss error">×</button>
        </div>
      )}
    </div>
  );
}

function btnSmall(base) {
  return { ...base, fontSize: 12, padding: "4px 12px" };
}

const srOnly = {
  position: "absolute",
  width: 1, height: 1,
  padding: 0, margin: -1, overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap", border: 0,
};
