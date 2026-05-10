import { useState } from "react";

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

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Stage4({ job, updateJob, goToStage }) {
  const ordinal = ORDINALS[job.installmentNumber] || `${job.installmentNumber}th`;
  const introTemplate = `The Middle East Studies Pedagogy Initiative (MESPI) brings you the ${ordinal} in a series of "Peer-Reviewed Article Reviews" in which we present a collection of journals and their articles concerned with the Middle East and Arab world. This series will be published seasonally. Each issue will comprise three-to-four parts, depending on the number of articles included.`;

  const [introText, setIntroText] = useState(job.introText || introTemplate);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [zipBlob, setZipBlob] = useState(null);

  const partCounts = ["Part 1","Part 2","Part 3","Part 4"].map(p => ({
    part: p,
    count: (job.articles || []).filter(a => a.part === p).length,
  }));

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const resp = await fetch(`${BACKEND}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_number: job.installmentNumber,
          season_year: job.seasonYear,
          articles: job.articles,
          intro_override: introText,
        }),
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const blob = await resp.blob();
      setZipBlob(blob);
      setDone(true);
      updateJob({ stage: 5, introText, zipBlob: null }); // persist intro so Stage 5 can re-download with it
    } catch (e) {
      setError("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  function downloadZip() {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PRAR_Installment_${job.installmentNumber}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    goToStage(5);
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={h2}>Stage 4 — Generate Documents</h2>
      <p style={{ color: "#7a6a5a", fontSize: 14, marginBottom: 28 }}>
        Review the document details below, then generate the four PRAR Word documents.
      </p>

      {/* Document titles preview */}
      <div style={card}>
        <h3 style={cardTitle}>Document Titles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[1,2,3,4].map(n => (
            <div key={n} style={{ background: "#fffbf0", border: "1px solid #e0d6c8", borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4, letterSpacing: 0.5 }}>PART {n}</div>
              <div style={{ fontStyle: "italic", fontSize: 14, color: "#2c1810" }}>
                Peer-Reviewed Articles Review: {job.seasonYear} (Part {n})
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                File: PRAR_Installment_{job.installmentNumber}_Part_{n}.docx
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intro paragraph editor */}
      <div style={card}>
        <h3 style={cardTitle}>Introductory Paragraph</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 10 }}>
          This paragraph appears at the top of all four documents, below the title. Edit if needed.
        </p>
        <textarea
          value={introText}
          onChange={e => setIntroText(e.target.value)}
          rows={5}
          style={{
            width: "100%", fontFamily: "Crimson Text, serif", fontSize: 14,
            border: "1px solid #d0c8b8", borderRadius: 6, padding: "10px 14px",
            lineHeight: 1.6, color: "#2c1810", background: "#fffbf0",
            boxSizing: "border-box", resize: "vertical",
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: "#aaa" }}>
          The word in <span style={{ color: "#d4af7a" }}>gold</span> is auto-generated from installment #{job.installmentNumber}: "<em>{ordinal}</em>"
        </div>
      </div>

      {/* Article counts */}
      <div style={card}>
        <h3 style={cardTitle}>Articles Per Part</h3>
        <div style={{ display: "flex", gap: 12 }}>
          {partCounts.map(({ part, count }) => (
            <div key={part} style={{
              flex: 1, background: count === 0 ? "#fff5f5" : "#f0faf0",
              border: `1px solid ${count === 0 ? "#ffcdd2" : "#c8e6c9"}`,
              borderRadius: 6, padding: "12px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: count === 0 ? "#e53935" : "#2c1810", fontFamily: "Crimson Text, serif" }}>{count}</div>
              <div style={{ fontSize: 13, color: "#666", fontFamily: "Crimson Text, serif" }}>{part}</div>
              {count === 0 && <div style={{ fontSize: 11, color: "#e53935", marginTop: 4 }}>Empty — document will be blank</div>}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#ff7c7c22", border: "1px solid #ff7c7c", borderRadius: 6, padding: "10px 16px", color: "#ff7c7c", marginBottom: 16, fontSize: 14 }}>
          {error}
          <div style={{ marginTop: 6, fontSize: 12 }}>Note: If this is the first request in a while, the backend may be waking up (30–60 seconds). Please try again.</div>
        </div>
      )}

      {/* Document preview */}
      <DocumentPreview
        articles={job.articles || []}
        seasonYear={job.seasonYear}
        introText={introText}
        installmentNumber={job.installmentNumber}
      />

      {error && (
        <div style={{ background: "#ff7c7c22", border: "1px solid #ff7c7c", borderRadius: 6, padding: "10px 16px", color: "#ff7c7c", marginBottom: 16, fontSize: 14 }}>
          {error}
          <div style={{ marginTop: 6, fontSize: 12 }}>Note: If this is the first request in a while, the backend may be waking up (30–60 seconds). Please try again.</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {!done ? (
          <button onClick={handleGenerate} disabled={generating} style={{ ...btnPrimary, opacity: generating ? 0.6 : 1, fontSize: 15, padding: "10px 28px" }}>
            {generating ? "⏳ Generating documents..." : "Generate 4 PRAR Documents"}
          </button>
        ) : (
          <button onClick={downloadZip} style={{ ...btnPrimary, background: "#2c6e49", fontSize: 15, padding: "10px 28px" }}>
            ⬇ Download ZIP (4 documents) & Proceed
          </button>
        )}
      </div>
    </div>
  );
}

const h2 = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 22, fontWeight: 400, margin: "0 0 4px" };
const btnPrimary = { background: "#2c1810", color: "#d4af7a", border: "none", padding: "8px 20px", borderRadius: 5, fontFamily: "Crimson Text, serif", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const card = { background: "#fff", border: "1px solid #e0d6c8", borderRadius: 8, padding: "20px 24px", marginBottom: 20 };
const cardTitle = { color: "#2c1810", fontFamily: "Crimson Text, serif", fontSize: 16, fontWeight: 600, margin: "0 0 14px" };

function DocumentPreview({ articles, seasonYear, introText, installmentNumber }) {
  const [previewPart, setPreviewPart] = useState("Part 1");
  const [showPreview, setShowPreview] = useState(false);

  const partArticles = articles
    .filter(a => a.part === previewPart)
    .sort((a, b) => a.journal.localeCompare(b.journal))
    .slice(0, 5);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPreview ? 14 : 0 }}>
        <h3 style={{ ...cardTitle, margin: 0 }}>Document Preview</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {showPreview && (
            <select value={previewPart} onChange={e => setPreviewPart(e.target.value)} style={{
              fontFamily: "Crimson Text, serif", fontSize: 13, padding: "4px 10px",
              border: "1px solid #d0c8b8", borderRadius: 5, background: "#fff",
            }}>
              {["Part 1","Part 2","Part 3","Part 4"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <button onClick={() => setShowPreview(s => !s)} style={{
            background: "transparent", color: "#2c1810", border: "1px solid #2c1810",
            padding: "5px 14px", borderRadius: 5, fontFamily: "Crimson Text, serif",
            fontSize: 13, cursor: "pointer",
          }}>
            {showPreview ? "▲ Hide Preview" : "▼ Show Preview"}
          </button>
        </div>
      </div>

      {showPreview && (
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
            Showing first {partArticles.length} articles of {articles.filter(a => a.part === previewPart).length} in {previewPart}
          </div>
          {/* Simulated document */}
          <div style={{
            background: "#fff", border: "1px solid #d0c8b8", borderRadius: 6,
            padding: "32px 40px", fontFamily: "Garamond, Georgia, serif",
            maxHeight: "70vh", overflowY: "auto", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.06)",
          }}>
            {/* Document title */}
            <div style={{ fontStyle: "italic", fontSize: 16, marginBottom: 16, color: "#2c1810" }}>
              Peer-Reviewed Articles Review: {seasonYear} ({previewPart})
            </div>
            {/* Intro */}
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 24, color: "#333" }}>
              {introText}
            </div>
            {/* Articles */}
            {partArticles.length === 0 ? (
              <div style={{ color: "#aaa", fontSize: 13, fontStyle: "italic" }}>No articles in this part.</div>
            ) : (
              partArticles.map((art, i) => {
                const showJournal = i === 0 || art.journal !== partArticles[i - 1].journal;
                return (
                  <div key={i} style={{ marginBottom: 18 }}>
                    {showJournal && (
                      <div style={{ fontStyle: "italic", fontSize: 13, color: "#2c1810", marginBottom: 6, marginTop: i > 0 ? 14 : 0 }}>
                        {art.journal} (Volume {art.volume}, Issue {art.issue})
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "#1a6bb5", marginBottom: 4 }}>
                      {art.link
                        ? <a href={art.link} target="_blank" rel="noopener noreferrer" style={{ color: "#1a6bb5" }}>{art.title}</a>
                        : art.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#444", marginBottom: 3 }}>By: {art.author}</div>
                    <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>Abstract: {art.abstract}</div>
                  </div>
                );
              })
            )}
            {articles.filter(a => a.part === previewPart).length > 5 && (
              <div style={{ color: "#aaa", fontSize: 12, fontStyle: "italic", marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}>
                … and {articles.filter(a => a.part === previewPart).length - 5} more articles
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
