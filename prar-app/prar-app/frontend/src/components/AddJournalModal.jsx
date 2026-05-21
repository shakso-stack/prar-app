import { useEffect, useState } from "react";
import { COLORS, FONTS, styles } from "../lib/styles";

// AddJournalModal — small dialog for adding a new master journal. Validates
// non-empty journal name; tier and ISSN are optional but recommended. Escape
// closes; Enter in any field submits.
//
// Props:
//   existingIssns : Set<string> of ISSNs already in the list (case-insensitive)
//   onCancel : () => void
//   onSave   : ({ tier, journal, issn }) => Promise<void>

export default function AddJournalModal({ existingIssns, onCancel, onSave }) {
  const [form, setForm] = useState({ tier: "1", journal: "", issn: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function clean(v) {
    return v ? v.trim().replace(/\s+/g, " ") : "";
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const journal = clean(form.journal);
    if (!journal) { setError("Journal name is required."); return; }

    const issn = clean(form.issn);
    if (issn && existingIssns && existingIssns.has(issn.toLowerCase())) {
      setError("A journal with this ISSN is already in the list.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        tier: clean(form.tier) || null,
        journal,
        issn: issn || null,
      });
    } catch (err) {
      setError(err.message || "Could not add journal.");
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-journal-title"
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
        padding: "26px 30px",
        maxWidth: 520,
        width: "100%",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: COLORS.shadowDeep,
        border: `1px solid ${COLORS.borderSoft}`,
      }}>
        <h2 id="add-journal-title" style={{
          fontFamily: FONTS.display,
          fontSize: 22, fontWeight: 500,
          margin: "0 0 4px", color: COLORS.gold,
          letterSpacing: "0.3px",
        }}>Add a journal</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          New journals are sorted into place automatically by tier and name.
        </p>

        {error && <div style={styles.banner("error")} role="alert">{error}</div>}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="add-journal-tier" style={styles.label}>Tier</label>
            <select
              id="add-journal-tier"
              value={form.tier}
              onChange={e => update("tier", e.target.value)}
              style={styles.input}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="add-journal-name" style={styles.label}>
              Journal name <span aria-hidden="true" style={{ color: COLORS.danger, marginLeft: 2 }}>*</span>
            </label>
            <input
              id="add-journal-name"
              required
              value={form.journal}
              onChange={e => update("journal", e.target.value)}
              autoFocus
              style={styles.input}
              placeholder="e.g. Journal of Middle Eastern Studies"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="add-journal-issn" style={styles.label}>ISSN</label>
            <input
              id="add-journal-issn"
              value={form.issn}
              onChange={e => update("issn", e.target.value)}
              style={styles.input}
              placeholder="e.g. 1234-5678"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <button type="button" onClick={onCancel} style={styles.btnOutline}>Cancel</button>
            <button
              type="submit"
              disabled={saving || !form.journal.trim()}
              style={{
                ...styles.btnPrimary,
                opacity: (saving || !form.journal.trim()) ? 0.5 : 1,
                cursor: (saving || !form.journal.trim()) ? "default" : "pointer",
              }}
            >
              {saving ? "Adding…" : "Add journal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
