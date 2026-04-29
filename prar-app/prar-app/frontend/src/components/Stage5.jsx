import { useState } from "react";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const PART_COLORS = {
  "Part 1": { bg: "#FFF3E0", border: "#FF6600", text: "#E65100" },
  "Part 2": { bg: "#E3F2FD", border: "#2196F3", text: "#0D47A1" },
  "Part 3": { bg: "#E8F5E9", border: "#4CAF50", text: "#1B5E20" },
  "Part 4": { bg: "#F3E5F5", border: "#9C27B0", text: "#4A148C" },
};

export default function Stage5({ job, goToStage, onBack }) {
  const [downloading, setDownloading] = useState({});
  const [error, setError] = useState("");

  async function downloadDocs() {
    setDownloading(d => ({ ...d, docs: true }));
    setError("");
    try {
      const resp = await fetch(`${BACKEND}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_number: job.installmentNumber,
          season_year: job.seasonYear,
          articles: job.articles,
        }),
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PRAR_Installment_${job.installmentNumber}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Download failed: " + e.message + ". The backend may be waking up — please try again in 30 seconds.");
    } finally {
      setDownloading(d => ({ ...d, docs: false }));
    }
  }

  async function downloadExcel() {
    setDownloading(d => ({ ...d, excel: true }));
    setError("");
    try {
      const resp = await fetch(`${BACKEND}/export-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_number: job.installmentNumber,
          season_year: job.seasonYear,
          articles: job.articles,
        }),
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PRAR_Installment_${job.installmentNumber}_Compiled.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(d => ({ ...d, excel: false }));
    }
  }

  const partCounts = ["Part 1","Part 2","Part 3","Part 4"].map(p => ({
    part: p,
    count: (job.articles || []).filter(a => a.part === p).length,
  }));

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }}>
      <h2 style={h2}>Stage 5 — Download</h2>
      <p style={{ color: "#7a6a5a", fontSize: 14, marginBottom: 28 }}>
        Your PRAR Installment {job.installmentNumber} is ready. Download your documents below.
      </p>

      {/* Summary */}
      <div style={{ background: "#fff", border: "1px solid #e0d6c8", borderRadius: 8, padding: "20px 24px", marginBottom: 24 }}>
        <h3 style={cardTitle}>Installment Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <div style={infoRow}><span style={infoLabel}>Installment</span><span>{job.name}</span></div>
          <div style={infoRow}><span style={infoLabel}>Number</span><span>#{job.installmentNumber}</span></div>
          <div style={infoRow}><span style={infoLabel}>Season / Year</span><span>{job.seasonYear}</span></div>
          <div style={infoRow}><span style={infoLabel}>Total Articles</span><span>{(job.articles||[]).length}</span></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {partCounts.map(({ part, count }) => {
            const pc = PART_COLORS[part];
            return (
              <div key={part} style={{
                flex: 1, background: pc.bg, border: `1px solid ${pc.border}`,
                borderRadius: 6, padding: "8px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: pc.text, fontFamily: "Crimson Text, serif" }}>{count}</div>
                <div style={{ fontSize: 12, color: pc.text, fontFamily: "Crimson Text, serif" }}>{part}</div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ background: "#ff7c7c22", border: "1px solid #ff7c7c", borderRadius: 6, padding: "10px 16px", color: "#ff7c7c", marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Download buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={downloadCard}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#2c1810", marginBottom: 4 }}>
              📄 PRAR Documents (ZIP)
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              4 Word documents — one per Part — with titles, intro paragraphs, and hyperlinked article titles.
              <br />
              <span style={{ fontSize: 12 }}>
                {["Part 1","Part 2","Part 3","Part 4"].map(p => `PRAR_Installment_${job.installmentNumber}_${p.replace(" ","_")}.docx`).join(" · ")}
              </span>
            </div>
          </div>
          <button onClick={downloadDocs} disabled={downloading.docs} style={{ ...btnDownload("#2c1810", "#d4af7a"), opacity: downloading.docs ? 0.6 : 1 }}>
            {downloading.docs ? "⏳ Generating..." : "⬇ Download ZIP"}
          </button>
        </div>

        <div style={downloadCard}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#2c1810", marginBottom: 4 }}>
              📊 Compiled Data (Excel)
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              Excel workbook with All Articles sheet + Part 1–4 sheets, color-coded by part.
              <br />
              <span style={{ fontSize: 12 }}>PRAR_Installment_{job.installmentNumber}_Compiled.xlsx</span>
            </div>
          </div>
          <button onClick={downloadExcel} disabled={downloading.excel} style={{ ...btnDownload("#2c6e49", "#fff"), opacity: downloading.excel ? 0.6 : 1 }}>
            {downloading.excel ? "⏳ Generating..." : "⬇ Download Excel"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e0d6c8" }}>
        <button onClick={onBack} style={{ ...btnOutline, marginRight: 12 }}>← Back to Dashboard</button>
        <span style={{ color: "#aaa", fontSize: 13 }}>
          This installment is saved. You can return to it anytime from the Dashboard.
        </span>
      </div>
    </div>
  );
}

const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const cardTitle = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 16, fontWeight: 600, margin: "0 0 14px" };
const infoRow = { display: "flex", flexDirection: "column", background: "#faf8f5", borderRadius: 5, padding: "8px 12px" };
const infoLabel = { fontSize: 11, color: "#aaa", marginBottom: 2, letterSpacing: 0.5 };
const downloadCard = { background: "#fff", border: "1px solid #e0d6c8", borderRadius: 8, padding: "18px 20px", display: "flex", alignItems: "center", gap: 20 };
const btnDownload = (bg, color) => ({ background: bg, color, border: "none", padding: "10px 22px", borderRadius: 6, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" });
const btnOutline = { background: "transparent", color: "#2c1810", border: "1px solid #2c1810", padding: "7px 16px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 13, cursor: "pointer" };
