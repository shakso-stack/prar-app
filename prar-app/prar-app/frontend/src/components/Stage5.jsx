import { useState, useEffect, useMemo } from "react";
import { PART_MAP, PART_COLORS } from "../data";
import { COLORS, FONTS, styles } from "../lib/styles";
import { ordinalFor } from "../lib/util";
import { listArticles } from "../lib/db";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function buildDefaultIntro(installmentNumber, seasonYear) {
  const ord = ordinalFor(installmentNumber) || installmentNumber;
  return `MESPI introduces the ${ord} installment of the Peer-Reviewed Articles Review (PRAR), ${seasonYear}, an annotated compilation of recent peer-reviewed articles related to the Middle East. The PRAR is a quarterly publication that brings together the latest scholarship in the field, organized for convenient reference. Articles are arranged in four parts: Part 1 features regional-focused Middle East studies journals, Part 2 covers area studies journals with significant Middle East content, Part 3 includes security, terrorism, and conflict journals, and Part 4 features general political science, international relations, and area studies journals with Middle East content. We invite scholars and students to use this compilation as a starting point for further research.`;
}

export default function Stage5({ installment, goToStage }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [downloading, setDownloading] = useState(null);  // 'zip' | 'xlsx' | null
  const [error, setError] = useState("");

  const intro = useMemo(
    () => installment.intro_override || buildDefaultIntro(installment.installment_number, installment.season_year),
    [installment.intro_override, installment.installment_number, installment.season_year]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await listArticles(installment.id);
        const approved = all
          .filter(a => a.status === "approved" || a.status === "auto-approved")
          .map(a => ({ ...a, part: a.part || PART_MAP[(a.journal || "").trim()] || "" }));
        if (!cancelled) setArticles(approved);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load articles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [installment.id]);

  const counts = useMemo(() => ({
    "Part 1": articles.filter(a => a.part === "Part 1").length,
    "Part 2": articles.filter(a => a.part === "Part 2").length,
    "Part 3": articles.filter(a => a.part === "Part 3").length,
    "Part 4": articles.filter(a => a.part === "Part 4").length,
  }), [articles]);

  function articlesPayload() {
    return articles.map(a => ({
      author: a.author, title: a.title, journal: a.journal,
      volume: a.volume, issue: a.issue, year: a.year,
      tier: a.tier, abstract: a.abstract, link: a.link, doi: a.doi,
      status: a.status, part: a.part,
    }));
  }

  async function downloadZip() {
    setError("");
    setDownloading("zip");
    try {
      const resp = await fetch(`${BACKEND}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_number: installment.installment_number,
          season_year: installment.season_year,
          articles: articlesPayload(),
          intro_override: intro,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`ZIP download failed (${resp.status}): ${text.slice(0, 200)}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PRAR_${installment.installment_number}_${installment.season_year.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadExcel() {
    setError("");
    setDownloading("xlsx");
    try {
      const resp = await fetch(`${BACKEND}/export-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_number: installment.installment_number,
          season_year: installment.season_year,
          articles: articlesPayload(),
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Excel download failed (${resp.status}): ${text.slice(0, 200)}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PRAR_${installment.installment_number}_${installment.season_year.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <div style={{ padding: 80, textAlign: "center", color: COLORS.textMuted, fontFamily: FONTS.serif }}>Loading…</div>;
  if (loadError) return (
    <div style={{ padding: 80, textAlign: "center", fontFamily: FONTS.serif }}>
      <div style={{ color: COLORS.danger, marginBottom: 12 }}>{loadError}</div>
      <button onClick={() => window.location.reload()} style={styles.btnOutline}>Reload</button>
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 880, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={styles.h2}>Stage 5 — Download</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 720 }}>
          Your installment is ready. Download the four PRAR Word documents and the compiled Excel workbook for your archive.
        </p>
      </div>

      {error && <div style={styles.banner("error")} role="alert">{error}</div>}

      {/* Summary */}
      <div style={{ ...styles.card, marginBottom: 18 }}>
        <h3 style={styles.h3}>Installment summary</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <SummaryPill label="Name" value={installment.name} />
          <SummaryPill label="Installment" value={`#${installment.installment_number}`} />
          <SummaryPill label="Season / Year" value={installment.season_year} />
          <SummaryPill label="Total approved" value={`${articles.length} articles`} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["Part 1","Part 2","Part 3","Part 4"].map(p => {
            const pc = PART_COLORS[p];
            return (
              <div key={p} style={{
                background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 8,
                padding: "10px 16px", display: "flex", flexDirection: "column",
                alignItems: "center", color: pc.text,
                fontFamily: FONTS.serif, minWidth: 90,
              }}>
                <span style={{ fontSize: 20, fontWeight: 600 }}>{counts[p]}</span>
                <span style={{ fontSize: 11 }}>{p}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Intro (read-only) */}
      <div style={{ ...styles.card, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ ...styles.h3, margin: 0 }}>Introduction</h3>
          <button onClick={() => goToStage(4)} style={{ ...styles.btnSubtle, fontSize: 12, padding: "4px 12px" }}>
            ← Edit in Stage 4
          </button>
        </div>
        <div style={{
          background: COLORS.bgPanelDeep, border: `1px solid ${COLORS.borderSoft}`,
          padding: "14px 16px", borderRadius: 5,
          fontFamily: FONTS.serif, fontSize: 14, lineHeight: 1.5,
          color: COLORS.textBody,
        }}>
          {intro}
        </div>
      </div>

      {/* Downloads */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <DownloadCard
          title="Four PRAR Word documents"
          subtitle="One .docx per Part, packaged into a single ZIP. This is the final publication output."
          buttonLabel={downloading === "zip" ? "Building ZIP…" : "↓ Download ZIP"}
          onClick={downloadZip}
          disabled={!!downloading || articles.length === 0}
        />
        <DownloadCard
          title="Compiled Excel workbook"
          subtitle="All approved articles in one .xlsx — useful for your archive or for re-importing into a later installment."
          buttonLabel={downloading === "xlsx" ? "Building XLSX…" : "↓ Download XLSX"}
          onClick={downloadExcel}
          disabled={!!downloading || articles.length === 0}
        />
      </div>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div style={{
      background: COLORS.bgPanelDeep,
      border: `1px solid ${COLORS.borderSoft}`,
      borderRadius: 6, padding: "6px 14px",
      fontFamily: FONTS.serif,
    }}>
      <div style={{ fontSize: 10, color: COLORS.goldMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: COLORS.textBody, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function DownloadCard({ title, subtitle, buttonLabel, onClick, disabled }) {
  return (
    <div style={{
      background: COLORS.bgPanel,
      border: `1px solid ${COLORS.borderSoft}`,
      borderRadius: 10, padding: "20px 22px",
      boxShadow: COLORS.shadowSoft,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <h3 style={{ ...styles.h3, margin: 0 }}>{title}</h3>
      <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.5, margin: 0, flex: 1 }}>{subtitle}</p>
      <button onClick={onClick} disabled={disabled} style={{
        ...styles.btnPrimary,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        alignSelf: "flex-start",
      }}>{buttonLabel}</button>
    </div>
  );
}
