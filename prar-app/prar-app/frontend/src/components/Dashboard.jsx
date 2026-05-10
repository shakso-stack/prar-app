import { useState, useRef } from "react";
import { createJob, deleteJob, exportJob, importJob, formatDate, stageLabel, saveMasterJournals, resetMasterJournals } from "../store";
import { JOURNALS } from "../data";

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

function ProgressBar({ currentStage }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {STAGE_STEPS.map((step, i) => {
          const done = currentStage > step.n;
          const active = currentStage === step.n;
          return (
            <div key={step.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              {i > 0 && <div style={{ height: 2, flex: 1, background: done || active ? "#d4af7a" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />}
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, fontFamily: "Crimson Text, serif",
                background: done ? "#d4af7a" : active ? "#2c1810" : "rgba(255,255,255,0.08)",
                border: done || active ? "2px solid #d4af7a" : "2px solid rgba(255,255,255,0.2)",
                color: done ? "#2c1810" : active ? "#d4af7a" : "rgba(255,255,255,0.3)",
                position: "relative",
              }}>
                {done ? "✓" : step.n}
                <div style={{ position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)", fontSize: 10, whiteSpace: "nowrap", color: done || active ? "#d4af7a" : "rgba(255,255,255,0.25)", fontWeight: active ? 600 : 400 }}>
                  {step.label}
                </div>
              </div>
              {i < STAGE_STEPS.length - 1 && <div style={{ height: 2, flex: 1, background: done ? "#d4af7a" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />}
            </div>
          );
        })}
      </div>
      <div style={{ height: 18 }} />
    </div>
  );
}

// ─── Manage Journal List Panel ────────────────────────────────────────────────

function ManageJournals({ masterJournals, setMasterJournals, onClose }) {
  const [rows, setRows] = useState(() =>
    masterJournals.map((j, i) => ({ ...j, _id: i }))
  );
  const [filterText, setFilterText] = useState("");
  const [saved, setSaved] = useState(false);

  function updateCell(id, field, value) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
    setSaved(false);
  }

  function addRow() {
    const newId = Math.max(0, ...rows.map(r => r._id)) + 1;
    setRows(prev => [...prev, { _id: newId, tier: "", journal: "", issn: "" }]);
    setSaved(false);
  }

  function deleteRow(id) {
    setRows(prev => prev.filter(r => r._id !== id));
    setSaved(false);
  }

  function handleSave() {
    const clean = rows.map(({ _id, ...rest }) => rest).filter(r => r.journal && r.issn);
    setMasterJournals(clean);
    saveMasterJournals(clean);
    setSaved(true);
  }

  function handleReset() {
    if (window.confirm("Reset to the original factory journal list? This cannot be undone.")) {
      const reset = resetMasterJournals(JOURNALS);
      setMasterJournals(reset);
      setRows(reset.map((j, i) => ({ ...j, _id: i })));
      setSaved(true);
    }
  }

  const filtered = rows.filter(r =>
    !filterText || r.journal?.toLowerCase().includes(filterText.toLowerCase()) || r.issn?.includes(filterText)
  );

  const COLS = [
    { key: "tier",    label: "Tier",    width: 60 },
    { key: "journal", label: "Journal", width: 320 },
    { key: "issn",    label: "ISSN",    width: 130 },
  ];

  return (
    <div style={{ background: "#2c1810", border: "1px solid #d4af7a", borderRadius: 10, padding: 24, marginBottom: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ color: "#d4af7a", margin: "0 0 4px", fontSize: 18, fontWeight: 400 }}>Manage Journal List</h3>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>
            Changes saved here will apply to all new installments. Existing jobs are unaffected.
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontFamily: "Crimson Text, serif", fontSize: 13 }}>✕ Close</button>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <input placeholder="Filter journals or ISSN..." value={filterText} onChange={e => setFilterText(e.target.value)}
          style={{ ...inputStyle, width: 260 }} />
        <button onClick={addRow} style={btnOutline}>+ Add Row</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={handleReset} style={{ ...btnOutline, color: "#ff9800", borderColor: "#ff9800" }}>↺ Reset to Original</button>
          <button onClick={handleSave} style={{ ...btnPrimary, background: saved ? "#2c6e49" : "#d4af7a" }}>
            {saved ? "✓ Saved as Default" : "Save as Default"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #5a3a28", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "#1a0f0a" }}>
                <th style={{ ...thStyle, width: 36 }}>#</th>
                {COLS.map(c => <th key={c.key} style={{ ...thStyle, width: c.width }}>{c.label}</th>)}
                <th style={{ ...thStyle, width: 40 }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={row._id} style={{ background: idx % 2 === 0 ? "#2c1810" : "#351e12", borderBottom: "1px solid #4a2c1a" }}>
                  <td style={{ ...tdStyle, color: "#888", fontSize: 11, textAlign: "center" }}>{idx + 1}</td>
                  {COLS.map(c => (
                    <td key={c.key} style={tdStyle}>
                      <input value={row[c.key] || ""} onChange={e => updateCell(row._id, c.key, e.target.value)}
                        style={{ width: "100%", border: "none", background: "transparent", fontFamily: "Crimson Text, serif", fontSize: 13, color: "#fff", padding: "4px 6px", outline: "none" }}
                        onFocus={e => e.target.style.background = "rgba(212,175,122,0.1)"}
                        onBlur={e => e.target.style.background = "transparent"} />
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button onClick={() => deleteRow(row._id)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}
                      onMouseEnter={e => e.target.style.color = "#ff5252"}
                      onMouseLeave={e => e.target.style.color = "#888"}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
        {rows.length} journals · {filtered.length} shown · Journals without a Journal name or ISSN will be excluded when saving
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ jobs, setJobs, addJob, removeJob, masterJournals, setMasterJournals, onOpen }) {
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
    const job = createJob(form.name.trim(), parseInt(form.installmentNumber), form.seasonYear.trim(), masterJournals);
    addJob(job);
    onOpen(job.id);
  }

  function handleDelete(id, name) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      removeJob(id);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1a0f0a", fontFamily: "Crimson Text, serif" }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 340, overflow: "hidden" }}>
        <img src="/hero.png" alt="PRAR" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.65)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(26,15,10,0.2), rgba(26,15,10,0.85))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 40 }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#d4af7a", textTransform: "uppercase", marginBottom: 10, opacity: 0.8 }}>Periodic Review Tool</div>
          <h1 style={{ fontSize: 42, color: "#fff", fontWeight: 400, margin: 0, textAlign: "center", letterSpacing: 1, textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>Peer-Reviewed Articles Review</h1>
          <div style={{ width: 80, height: 2, background: "#d4af7a", margin: "16px auto 0" }} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ color: "#d4af7a", fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: 0.5 }}>PRAR Installments</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => importRef.current.click()} style={btnStyle("outline")}>Import Backup</button>
            <input ref={importRef} type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (file) importJob(file, (job) => addJob(job));
                e.target.value = "";
              }} />
            <button onClick={() => setShowManage(s => !s)} style={{
              ...btnStyle("outline"),
              borderColor: showManage ? "#d4af7a" : "rgba(212,175,122,0.5)",
              color: showManage ? "#d4af7a" : "rgba(212,175,122,0.6)",
            }}>
              ⚙ Manage Journal List
            </button>
            <button onClick={() => { setShowNew(true); setError(""); setForm({ name: "", installmentNumber: "", seasonYear: "" }); }}
              style={btnStyle("primary")}>
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
          <div style={{ background: "#2c1810", border: "1px solid #5a3a28", borderRadius: 10, padding: 28, marginBottom: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
            <h3 style={{ color: "#d4af7a", margin: "0 0 20px", fontSize: 18, fontWeight: 400 }}>New PRAR Installment</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Installment Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PRAR Installment 27" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Installment Number</label>
                <input value={form.installmentNumber} onChange={e => setForm(f => ({ ...f, installmentNumber: e.target.value }))} placeholder="e.g. 27" type="number" min="1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Season / Year</label>
                <input value={form.seasonYear} onChange={e => setForm(f => ({ ...f, seasonYear: e.target.value }))} placeholder="e.g. Fall 2024" style={inputStyle} />
              </div>
            </div>
            {form.installmentNumber && ORDINALS[parseInt(form.installmentNumber)] && (
              <div style={{ color: "rgba(212,175,122,0.7)", fontSize: 13, marginBottom: 12 }}>
                Preview intro word: "<em>{ORDINALS[parseInt(form.installmentNumber)]}</em>" · Using master list with {masterJournals.length} journals
              </div>
            )}
            {error && <div style={{ color: "#ff7c7c", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCreate} style={btnStyle("primary")}>Create & Open</button>
              <button onClick={() => setShowNew(false)} style={btnStyle("outline")}>Cancel</button>
            </div>
          </div>
        )}

        {/* Job list */}
        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)", fontSize: 16 }}>
            No installments yet. Create your first PRAR Installment to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {jobs.map(job => {
              const articleCount = job.articles?.length || 0;
              const reviewedCount = job.articles?.filter(a => a.status && a.status !== "pending").length || 0;
              const reviewPct = articleCount > 0 ? Math.round((reviewedCount / articleCount) * 100) : 0;
              return (
                <div key={job.id} style={{ background: "#2c1810", border: "1px solid #5a3a28", borderRadius: 10, padding: "18px 22px", transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#d4af7a"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#5a3a28"}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ color: "#fff", fontSize: 17, fontWeight: 400, marginBottom: 4 }}>{job.name}</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                        {job.seasonYear} · Installment #{job.installmentNumber}
                        {articleCount > 0 && ` · ${articleCount} articles`}
                        {job.stage >= 2 && articleCount > 0 && ` · ${reviewPct}% reviewed`}
                        {" · "}Last edited {formatDate(job.updatedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      <button onClick={() => exportJob(job)} style={btnStyle("outline", true)}>Export</button>
                      <button onClick={() => handleDelete(job.id, job.name)} style={btnStyle("danger", true)}>Delete</button>
                      <button onClick={() => onOpen(job.id)} style={btnStyle("primary", true)}>Open →</button>
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

function btnStyle(type, small = false) {
  const base = { fontFamily: "Crimson Text, serif", fontSize: small ? 13 : 14, padding: small ? "4px 14px" : "8px 20px", borderRadius: 5, cursor: "pointer", transition: "all 0.15s" };
  if (type === "primary") return { ...base, background: "#d4af7a", color: "#2c1810", border: "none", fontWeight: 600 };
  if (type === "outline") return { ...base, background: "transparent", color: "#d4af7a", border: "1px solid #d4af7a" };
  if (type === "danger") return { ...base, background: "transparent", color: "#ff7c7c", border: "1px solid #ff7c7c" };
}

const labelStyle = { display: "block", color: "rgba(212,175,122,0.7)", fontSize: 12, marginBottom: 6, letterSpacing: 0.5 };
const inputStyle = { width: "100%", padding: "8px 12px", background: "#1a0f0a", border: "1px solid #5a3a28", borderRadius: 5, color: "#fff", fontFamily: "Crimson Text, serif", fontSize: 14, boxSizing: "border-box" };
const btnOutline = { background: "transparent", color: "#d4af7a", border: "1px solid #d4af7a", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
const btnPrimary = { background: "#d4af7a", color: "#2c1810", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const thStyle = { padding: "10px 8px", color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 12, fontWeight: 600, textAlign: "left", letterSpacing: 0.5, borderRight: "1px solid #2a1208", background: "#1a0f0a" };
const tdStyle = { padding: "4px 6px", verticalAlign: "middle", borderRight: "1px solid #4a2c1a", fontFamily: "Crimson Text, serif" };
