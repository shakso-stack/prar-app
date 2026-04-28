import { useState, useRef } from "react";
import { loadJobs, createJob, saveJobs, deleteJob, exportJob, importJob, formatDate, stageLabel } from "../store";

const ORDINALS = {
  1:"first",2:"second",3:"third",4:"fourth",5:"fifth",6:"sixth",7:"seventh",
  8:"eighth",9:"ninth",10:"tenth",11:"eleventh",12:"twelfth",13:"thirteenth",
  14:"fourteenth",15:"fifteenth",16:"sixteenth",17:"seventeenth",18:"eighteenth",
  19:"nineteenth",20:"twentieth",21:"twenty-first",22:"twenty-second",
  23:"twenty-third",24:"twenty-fourth",25:"twenty-fifth",26:"twenty-sixth",
  27:"twenty-seventh",28:"twenty-eighth",29:"twenty-ninth",30:"thirtieth",
  31:"thirty-first",32:"thirty-second",33:"thirty-third",34:"thirty-fourth",
  35:"thirty-fifth"
};

export default function Dashboard({ jobs, setJobs, onOpen }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", installmentNumber: "", seasonYear: "" });
  const [error, setError] = useState("");
  const importRef = useRef();

  function handleCreate() {
    if (!form.name.trim()) return setError("Please enter a name for this installment.");
    if (!form.installmentNumber || isNaN(parseInt(form.installmentNumber)))
      return setError("Please enter a valid installment number.");
    if (!form.seasonYear.trim()) return setError("Please enter a season/year (e.g. Fall 2024).");
    const job = createJob(form.name.trim(), parseInt(form.installmentNumber), form.seasonYear.trim());
    const next = [job, ...jobs];
    setJobs(next);
    onOpen(job.id);
  }

  function handleDelete(id, name) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      setJobs(deleteJob(jobs, id));
    }
  }

  const stageColors = {
    1: "#d4af7a", 2: "#4fc3f7", 3: "#81c784", 4: "#ce93d8", 5: "#a5d6a7"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a0f0a", fontFamily: "Crimson Text, serif" }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 340, overflow: "hidden" }}>
        <img src="/hero.png" alt="PRAR" style={{
          width: "100%", height: "100%", objectFit: "cover",
          filter: "brightness(0.65)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(26,15,10,0.2), rgba(26,15,10,0.85))",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end", paddingBottom: 40,
        }}>
          <div style={{
            fontSize: 13, letterSpacing: 4, color: "#d4af7a",
            textTransform: "uppercase", marginBottom: 10, opacity: 0.8,
          }}>
            Periodic Review Tool
          </div>
          <h1 style={{
            fontSize: 42, color: "#fff", fontWeight: 400,
            margin: 0, textAlign: "center", letterSpacing: 1,
            textShadow: "0 2px 16px rgba(0,0,0,0.6)",
          }}>
            Peer-Reviewed Articles Review
          </h1>
          <div style={{ width: 80, height: 2, background: "#d4af7a", margin: "16px auto 0" }} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h2 style={{ color: "#d4af7a", fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: 0.5 }}>
            PRAR Installments
          </h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => importRef.current.click()} style={btnStyle("outline")}>
              Import Backup
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (file) importJob(file, (job) => {
                  const next = [job, ...jobs];
                  setJobs(next);
                });
                e.target.value = "";
              }} />
            <button onClick={() => { setShowNew(true); setError(""); setForm({ name: "", installmentNumber: "", seasonYear: "" }); }}
              style={btnStyle("primary")}>
              + New PRAR Installment
            </button>
          </div>
        </div>

        {/* New job modal */}
        {showNew && (
          <div style={{
            background: "#2c1810", border: "1px solid #5a3a28",
            borderRadius: 10, padding: 28, marginBottom: 28,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}>
            <h3 style={{ color: "#d4af7a", margin: "0 0 20px", fontSize: 18, fontWeight: 400 }}>
              New PRAR Installment
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Installment Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. PRAR Installment 27" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Installment Number</label>
                <input value={form.installmentNumber} onChange={e => setForm(f => ({ ...f, installmentNumber: e.target.value }))}
                  placeholder="e.g. 27" type="number" min="1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Season / Year</label>
                <input value={form.seasonYear} onChange={e => setForm(f => ({ ...f, seasonYear: e.target.value }))}
                  placeholder="e.g. Fall 2024" style={inputStyle} />
              </div>
            </div>
            {form.installmentNumber && ORDINALS[parseInt(form.installmentNumber)] && (
              <div style={{ color: "rgba(212,175,122,0.7)", fontSize: 13, marginBottom: 12 }}>
                Preview: "This is the <em>{ORDINALS[parseInt(form.installmentNumber)]}</em> installment..."
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
          <div style={{
            textAlign: "center", padding: "60px 0",
            color: "rgba(255,255,255,0.3)", fontSize: 16,
          }}>
            No installments yet. Create your first PRAR Installment to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {jobs.map(job => (
              <div key={job.id} style={{
                background: "#2c1810", border: "1px solid #5a3a28",
                borderRadius: 8, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 16,
                transition: "border-color 0.2s",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#d4af7a"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#5a3a28"}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <span style={{ color: "#fff", fontSize: 16, fontWeight: 400 }}>{job.name}</span>
                    <span style={{
                      background: stageColors[job.stage] + "22",
                      color: stageColors[job.stage],
                      border: `1px solid ${stageColors[job.stage]}66`,
                      borderRadius: 4, padding: "1px 8px", fontSize: 11,
                    }}>
                      {stageLabel(job.stage)}
                    </span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                    {job.seasonYear} · Installment #{job.installmentNumber}
                    {job.articles?.length > 0 && ` · ${job.articles.length} articles`}
                    {" · "} Last edited {formatDate(job.updatedAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportJob(job)} style={btnStyle("outline", true)}>Export</button>
                  <button onClick={() => handleDelete(job.id, job.name)} style={btnStyle("danger", true)}>Delete</button>
                  <button onClick={() => onOpen(job.id)} style={btnStyle("primary", true)}>Open →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(type, small = false) {
  const base = {
    fontFamily: "Crimson Text, serif",
    fontSize: small ? 13 : 14,
    padding: small ? "4px 14px" : "8px 20px",
    borderRadius: 5, cursor: "pointer",
    transition: "all 0.15s",
  };
  if (type === "primary") return { ...base, background: "#d4af7a", color: "#2c1810", border: "none", fontWeight: 600 };
  if (type === "outline") return { ...base, background: "transparent", color: "#d4af7a", border: "1px solid #d4af7a" };
  if (type === "danger") return { ...base, background: "transparent", color: "#ff7c7c", border: "1px solid #ff7c7c" };
}

const labelStyle = { display: "block", color: "rgba(212,175,122,0.7)", fontSize: 12, marginBottom: 6, letterSpacing: 0.5 };
const inputStyle = {
  width: "100%", padding: "8px 12px", background: "#1a0f0a",
  border: "1px solid #5a3a28", borderRadius: 5, color: "#fff",
  fontFamily: "Crimson Text, serif", fontSize: 14, boxSizing: "border-box",
};
