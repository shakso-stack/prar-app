import { useState, useRef, useMemo, useEffect } from "react";
import { createJob, exportJob, importJob, formatDate } from "../store";
import AccessibleGrid from "../lib/AccessibleGrid.jsx";
import AddJournalModal from "./AddJournalModal.jsx";
import { COLORS, FONTS, styles } from "../lib/styles";
import {
  addMasterJournal,
  updateMasterJournal,
  deleteMasterJournal,
} from "../lib/db";

const ORDINALS = {
  1:"first",2:"second",3:"third",4:"fourth",5:"fifth",6:"sixth",7:"seventh",
  8:"eighth",9:"ninth",10:"tenth",11:"eleventh",12:"twelfth",13:"thirteenth",
  14:"fourteenth",15:"fifteenth",16:"sixteenth",17:"seventeenth",18:"eighteenth",
  19:"nineteenth",20:"twentieth",21:"twenty-first",22:"twenty-second",
  23:"twenty-third",24:"twenty-fourth",25:"twenty-fifth",26:"twenty-sixth",
  27:"twenty-seventh",28:"twenty-eighth",29:"twenty-ninth",30:"thirtieth",
  31:"thirty-first",32:"thirty-second",33:"thirty-third",34:"thirty-fourth",
  35:"thirty-fifth",36:"thirty-sixth",37:"thirty-seventh",38:"thirty-eighth",
  39:"thirty-ninth",40:"fortieth",50:"fiftieth"
};

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
//
// Master journals sort by (tier ascending, journal name ascending). Tier may
// be null/empty — those sort to the end. Numeric tier values sort numerically,
// not lexically, so "10" comes after "9".

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

  // Always keep the displayed list sorted.
  const sorted = useMemo(() => sortMasterJournals(masterJournals), [masterJournals]);

  // Apply filter on top of the sorted view.
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

  // Highlight a row briefly after an edit re-sorts it into a new position.
  function flashRow(id) {
    setHighlightId(id);
    setTimeout(() => {
      setHighlightId(curr => curr === id ? null : curr);
    }, 1500);
  }

  // ─── DB operations ────────────────────────────────────────────────────────

  async function handleCellEdit(row, columnKey, newValue) {
    setError("");
    const patch = {};
    if (columnKey === "tier") patch.tier = newValue || null;
    else if (columnKey === "journal") patch.journal = newValue ? newValue.trim() : "";
    else if (columnKey === "issn") patch.issn = newValue ? newValue.trim() : null;
    else return;

    // Optimistic update so the row appears edited and re-sorted immediately.
    setMasterJournals(prev => prev.map(j => j.id === row.id ? { ...j, ...patch } : j));
    // Start the highlight now (not after the round-trip) so the editor can
    // see the row in its new sorted position while the change is in flight.
    flashRow(row.id);

    try {
      const updated = await updateMasterJournal(row.id, patch);
      // Replace with the server's authoritative copy (handles trim/etc).
      setMasterJournals(prev => prev.map(j => j.id === row.id ? { ...j, ...updated } : j));
    } catch (err) {
      // Roll back optimistic update.
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
    // Optimistic remove.
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

  // ─── Grid columns ─────────────────────────────────────────────────────────

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
      {/* Header */}
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

      {/* Live-region announcements for screen readers */}
      <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

      {/* Error banner */}
      {error && (
        <div style={styles.banner("error")} role="alert">
          {error}
        </div>
      )}

      {/* Toolbar */}
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

      {/* Grid */}
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

      {/* Add modal */}
      {showAddModal && (
        <AddJournalModal
          existingIssns={existingIssns}
          onCancel={() => setShowAddModal(false)}
          onSave={handleAddJournal}
        />
      )}

      {/* Delete confirm */}
      {rowToDelete && (
        <ConfirmDeleteDialog
          journal={rowToDelete}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(rowToDelete)}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({ journal, onCancel, onConfirm }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
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
        <h2 id="confirm-delete-title" style={{
          fontFamily: FONTS.display,
          fontSize: 20, fontWeight: 500,
          margin: "0 0 8px", color: COLORS.gold,
        }}>Remove journal?</h2>
        <p style={{ color: COLORS.textBody, fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
          <strong style={{ color: COLORS.gold }}>{journal.journal}</strong> will be removed
          from the master list. Existing installments are unaffected. This action cannot
          be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={styles.btnOutline} autoFocus>Cancel</button>
          <button onClick={onConfirm} style={styles.btnDanger}>Remove journal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({
  jobs, setJobs, addJob, removeJob,
  masterJournals, setMasterJournals,
  onOpen,
}) {
  const [showNew, setShowNew] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [form, setForm] = useState({ name: "", installmentNumber: "", seasonYear: "" });
  const [error, setError] = useState("");
  const importRef = useRef();

  function handleCreate() {
    if (!form.name.trim()) return setError("Please enter a name for this installment.");
    if (!form.installmentNumber || isNaN(parseInt(form.installmentNumber)))
      return setError("Please enter a valid installment number.");
    if (!form.seasonYear.trim()) return setError("Please enter a season/year (e.g. Fall 2024).");
    const job = createJob(
      form.name.trim(),
      parseInt(form.installmentNumber),
      form.seasonYear.trim(),
      masterJournals,
    );
    addJob(job);
    onOpen(job.id);
  }

  function handleDelete(id, name) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      removeJob(id);
    }
  }

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

      {/* Main content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px 60px" }}>
        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ ...styles.h2, margin: 0 }}>PRAR Installments</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => importRef.current.click()} style={styles.btnOutline}>Import Backup</button>
            <input ref={importRef} type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (file) importJob(file, (job) => addJob(job));
                e.target.value = "";
              }} />
            <button onClick={() => setShowManage(s => !s)} style={{
              ...styles.btnOutline,
              borderColor: showManage ? COLORS.gold : COLORS.goldMuted,
              color: showManage ? COLORS.gold : COLORS.goldMuted,
            }}>
              ⚙ Manage Journal List
            </button>
            <button onClick={() => { setShowNew(true); setError(""); setForm({ name: "", installmentNumber: "", seasonYear: "" }); }}
              style={styles.btnPrimary}>
              + New PRAR Installment
            </button>
          </div>
        </div>

        {/* Manage journal list panel */}
        {showManage && (
          <ManageJournals
            masterJournals={masterJournals}
            setMasterJournals={setMasterJournals}
            onClose={() => setShowManage(false)}
          />
        )}

        {/* New job form */}
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
              <button onClick={handleCreate} style={styles.btnPrimary}>Create & Open</button>
              <button onClick={() => setShowNew(false)} style={styles.btnOutline}>Cancel</button>
            </div>
          </div>
        )}

        {/* Job list */}
        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.textFaint, fontSize: 16 }}>
            No installments yet. Create your first PRAR Installment to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {jobs.map(job => {
              const articleCount = job.articles?.length || 0;
              const reviewedCount = job.articles?.filter(a => a.status && a.status !== "pending").length || 0;
              const reviewPct = articleCount > 0 ? Math.round((reviewedCount / articleCount) * 100) : 0;
              return (
                <div key={job.id} style={{
                  ...styles.card,
                  marginBottom: 0,
                  padding: "18px 22px",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.boxShadow = COLORS.shadowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.borderSoft; e.currentTarget.style.boxShadow = COLORS.shadowSoft; }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ color: COLORS.textBody, fontSize: 17, fontWeight: 500, marginBottom: 4 }}>{job.name}</div>
                      <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
                        {job.seasonYear} · Installment #{job.installmentNumber}
                        {articleCount > 0 && ` · ${articleCount} articles`}
                        {job.stage >= 2 && articleCount > 0 && ` · ${reviewPct}% reviewed`}
                        {" · "}Last edited {formatDate(job.updatedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      <button onClick={() => exportJob(job)} style={btnSmall(styles.btnOutline)}>Export</button>
                      <button onClick={() => handleDelete(job.id, job.name)} style={btnSmall(styles.btnDanger)}>Delete</button>
                      <button onClick={() => onOpen(job.id)} style={btnSmall(styles.btnPrimary)}>Open →</button>
                    </div>
                  </div>
                  <ProgressBar currentStage={job.stage || 1} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: small variants of the standard buttons for the per-card actions.
function btnSmall(base) {
  return { ...base, fontSize: 12, padding: "4px 12px" };
}

// Screen-reader-only utility style. Used for live region announcements.
const srOnly = {
  position: "absolute",
  width: 1, height: 1,
  padding: 0, margin: -1, overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap", border: 0,
};
