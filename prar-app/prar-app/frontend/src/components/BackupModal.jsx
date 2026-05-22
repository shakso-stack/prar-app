import { useState, useEffect, useRef } from "react";
import { COLORS, FONTS, styles } from "../lib/styles";
import { validateBackup, importInstallment, suggestImportName, installmentNameExists } from "../lib/backup";

// BackupImportModal — file picker → validate → confirm/rename → import.
// On success calls onImported(installment).

export default function BackupImportModal({ userId, onCancel, onImported }) {
  const fileInputRef = useRef(null);
  const [phase, setPhase] = useState("pick");     // pick | review | importing | done | error
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);     // the JSON blob
  const [summary, setSummary] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [nameWarning, setNameWarning] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function handleFileChosen(file) {
    setError("");
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); }
      catch { setError("This file is not valid JSON."); setPhase("error"); return; }

      const valid = validateBackup(data);
      if (!valid.ok) {
        setError(valid.error);
        setPhase("error");
        return;
      }
      setParsed(data);
      setSummary(valid.summary);

      // Suggest a non-colliding name.
      const suggested = await suggestImportName(valid.summary.name);
      setNameInput(suggested);
      if (suggested !== valid.summary.name) {
        setNameWarning(`An installment named "${valid.summary.name}" already exists. Suggested rename: "${suggested}".`);
      } else {
        setNameWarning("");
      }
      setPhase("review");
    } catch (err) {
      setError(err.message || "Could not read file.");
      setPhase("error");
    }
  }

  async function handleNameChange(v) {
    setNameInput(v);
    if (!v.trim()) { setNameWarning(""); return; }
    try {
      const exists = await installmentNameExists(v.trim());
      if (exists && v.trim() !== summary.name) {
        setNameWarning(`An installment with this name already exists.`);
      } else if (exists) {
        setNameWarning(`An installment with this name already exists. Please pick a different name.`);
      } else {
        setNameWarning("");
      }
    } catch { /* non-fatal */ }
  }

  async function handleImport() {
    if (!nameInput.trim()) {
      setError("Please choose a name.");
      return;
    }
    setError("");
    setPhase("importing");
    try {
      const created = await importInstallment(parsed, userId, nameInput.trim());
      setPhase("done");
      onImported(created);
    } catch (err) {
      setError(err.message || "Import failed.");
      setPhase("error");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="import-title"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "grid", placeItems: "center", padding: 24, zIndex: 300,
      }}>
      <div style={{
        background: COLORS.bgPanel, borderRadius: 10, padding: "28px 32px",
        maxWidth: 540, width: "100%", boxShadow: COLORS.shadowDeep,
        border: `1px solid ${COLORS.borderSoft}`, maxHeight: "90vh", overflow: "auto",
      }}>
        <h2 id="import-title" style={{
          fontFamily: FONTS.display, fontSize: 22, fontWeight: 500,
          margin: "0 0 6px", color: COLORS.gold,
        }}>Import installment from backup</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Restore an installment from a PRAR App backup JSON file. The imported installment
          gets its own fresh ID — the original (if any) is not touched.
        </p>

        {phase === "pick" && (
          <>
            <button onClick={() => fileInputRef.current?.click()}
              style={{ ...styles.btnPrimary, width: "100%", padding: "16px" }}>
              📂 Choose backup file (.json)
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json"
              onChange={e => handleFileChosen(e.target.files?.[0])}
              style={{ display: "none" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={onCancel} style={styles.btnOutline}>Cancel</button>
            </div>
          </>
        )}

        {phase === "review" && summary && (
          <>
            <div style={{ ...styles.cardCompact, background: COLORS.bgPanelDeep, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: COLORS.goldMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
                File · {fileName}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13, color: COLORS.textBody }}>
                <div>Original name: <strong>{summary.name}</strong></div>
                <div>Installment #: <strong>{summary.installmentNumber}</strong></div>
                <div>Season / year: <strong>{summary.seasonYear}</strong></div>
                <div>Stage on export: <strong>{summary.stage}</strong></div>
                <div>Journal issues: <strong>{summary.journalIssueCount}</strong></div>
                <div>Articles: <strong>{summary.articleCount}</strong></div>
                <div>Keywords: <strong>{summary.keywordCount}</strong></div>
                <div>Custom intro: <strong>{summary.hasIntroOverride ? "Yes" : "No"}</strong></div>
              </div>
            </div>

            <label htmlFor="import-name" style={styles.label}>Name for the imported installment</label>
            <input id="import-name" value={nameInput}
              onChange={e => handleNameChange(e.target.value)}
              style={styles.input} />
            {nameWarning && (
              <div style={{ ...styles.banner("warning"), marginTop: 8, marginBottom: 0 }} role="status">
                {nameWarning}
              </div>
            )}

            {error && <div style={{ ...styles.banner("error"), marginTop: 12 }} role="alert">{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button onClick={onCancel} style={styles.btnOutline}>Cancel</button>
              <button onClick={handleImport}
                disabled={!nameInput.trim() || nameWarning.includes("Please pick a different name")}
                style={{
                  ...styles.btnPrimary,
                  opacity: (!nameInput.trim() || nameWarning.includes("Please pick")) ? 0.5 : 1,
                  cursor: (!nameInput.trim() || nameWarning.includes("Please pick")) ? "default" : "pointer",
                }}>
                Import installment
              </button>
            </div>
          </>
        )}

        {phase === "importing" && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div aria-hidden="true" style={{
              width: 36, height: 36, margin: "0 auto 16px",
              border: `3px solid ${COLORS.gold}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ color: COLORS.gold, fontFamily: FONTS.serif, fontSize: 14 }}>
              Importing… inserting rows
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {phase === "error" && (
          <>
            <div style={styles.banner("error")} role="alert">
              <strong>Could not import: </strong>{error}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => {
                setPhase("pick");
                setError("");
                setParsed(null);
                setSummary(null);
                setFileName("");
                setNameInput("");
                setNameWarning("");
              }} style={styles.btnOutline}>Try another file</button>
              <button onClick={onCancel} style={styles.btnPrimary}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
