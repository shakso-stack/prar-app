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

export default function Stage4({ installment, setIntroOverride, goToStage }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [introText, setIntroText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPart, setPreviewPart] = useState("Part 1");
  const [error, setError] = useState("");

  const defaultIntro = useMemo(
    () => buildDefaultIntro(installment.installment_number, installment.season_year),
    [installment.installment_number, installment.season_year]
  );

  // Load articles on mount; seed intro from override or default.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await listArticles(installment.id);
        const approved = all
          .filter(a => a.status === "approved" || a.status === "auto-approved")
          .map(a => ({ ...a, part: a.part || PART_MAP[(a.journal || "").trim()] || "" }));
        if (!cancelled) {
          setArticles(approved);
          setIntroText(installment.intro_override || defaultIntro);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load articles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [installment.id, installment.intro_override, defaultIntro]);

  // Persist intro_override when the user changes it. We use a small debounce
  // so we don't write on every keystroke.
  useEffect(() => {
    if (!introText) return;
    if (loading) return;
    // If the text matches the default exactly, clear the override (store null).
    const target = introText === defaultIntro ? null : introText;
    const handle = setTimeout(() => {
      setIntroOverride(target).catch(err => setError(err.message || "Could not save intro."));
    }, 600);
    return () => clearTimeout(handle);
  }, [introText, defaultIntro, loading, setIntroOverride]);

  const counts = useMemo(() => ({
    "Part 1": articles.filter(a => a.part === "Part 1").length,
    "Part 2": articles.filter(a => a.part === "Part 2").length,
    "Part 3": articles.filter(a => a.part === "Part 3").length,
    "Part 4": articles.filter(a => a.part === "Part 4").length,
  }), [articles]);

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const resp = await fetch(`${BACKEND}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_number: installment.installment_number,
          season_year: installment.season_year,
          articles: articles.map(a => ({
            author: a.author, title: a.title, journal: a.journal,
            volume: a.volume, issue: a.issue, year: a.year,
            tier: a.tier, abstract: a.abstract, link: a.link, doi: a.doi,
            status: a.status, part: a.part,
          })),
          intro_override: introText,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Generate failed (${resp.status}): ${text.slice(0, 200)}`);
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
      goToStage(5);
    } catch (err) {
      setError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
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
    <div style={{ padding: "28px 32px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={styles.h2}>Stage 4 — Generate</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 720 }}>
            Review the introductory paragraph and per-part counts, preview any part if you'd like, then click Generate to build the four Word documents.
          </p>
        </div>
        <button onClick={handleGenerate} disabled={generating || articles.length === 0}
          style={{ ...styles.btnPrimary, opacity: (generating || articles.length === 0) ? 0.5 : 1, cursor: (generating || articles.length === 0) ? "default" : "pointer" }}>
          {generating ? "Generating…" : `Generate (${articles.length} articles) →`}
        </button>
      </div>

      {error && <div style={styles.banner("error")} role="alert">{error}</div>}

      {/* Per-part counts */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {["Part 1","Part 2","Part 3","Part 4"].map(p => {
          const pc = PART_COLORS[p];
          return (
            <div key={p} style={{
              background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 8,
              padding: "10px 18px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 2, color: pc.text,
              fontFamily: FONTS.serif, minWidth: 100,
            }}>
              <span style={{ fontSize: 22, fontWeight: 600 }}>{counts[p]}</span>
              <span style={{ fontSize: 12 }}>{p}</span>
            </div>
          );
        })}
      </div>

      {/* Intro editor */}
      <div style={{ ...styles.card, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ ...styles.h3, margin: 0 }}>Introduction</h3>
          {introText !== defaultIntro && (
            <button onClick={() => setIntroText(defaultIntro)} style={{ ...styles.btnSubtle, fontSize: 12, padding: "4px 12px" }}>
              ↺ Reset to default
            </button>
          )}
        </div>
        <textarea
          value={introText}
          onChange={e => setIntroText(e.target.value)}
          rows={10}
          style={{ ...styles.textarea, minHeight: 200, fontSize: 14, lineHeight: 1.5 }}
          aria-label="Introduction paragraph"
        />
        <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textFaint }}>
          {introText === defaultIntro
            ? "Using default introduction template. Edits autosave."
            : "Edits autosave. Reset link above returns to the default template."}
        </div>
      </div>

      {/* Preview */}
      <div style={{ ...styles.card, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ ...styles.h3, margin: 0 }}>Document preview</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={previewPart} onChange={e => setPreviewPart(e.target.value)}
              aria-label="Preview part"
              style={{ ...styles.input, width: "auto", padding: "5px 10px", fontSize: 13 }}>
              <option value="Part 1">Part 1 ({counts["Part 1"]})</option>
              <option value="Part 2">Part 2 ({counts["Part 2"]})</option>
              <option value="Part 3">Part 3 ({counts["Part 3"]})</option>
              <option value="Part 4">Part 4 ({counts["Part 4"]})</option>
            </select>
            <button onClick={() => setShowPreview(s => !s)} style={styles.btnOutline}>
              {showPreview ? "▲ Hide" : "▼ Show"} preview
            </button>
          </div>
        </div>
        {showPreview && (
          <DocumentPreview
            installment={installment}
            articles={articles.filter(a => a.part === previewPart)}
            intro={introText}
            part={previewPart}
          />
        )}
      </div>
    </div>
  );
}

function DocumentPreview({ installment, articles, intro, part }) {
  const pc = PART_COLORS[part];
  const sample = articles.slice(0, 5);
  return (
    <div style={{
      background: "#f5e9d0", color: "#1a1a1a",
      padding: "24px 28px", borderRadius: 6,
      border: `2px solid ${pc.border}`,
      fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.5,
    }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", textTransform: "uppercase", marginBottom: 8 }}>
          MESPI · Installment #{installment.installment_number} · {installment.season_year}
        </div>
        <h2 style={{ fontSize: 22, margin: "0 0 6px", color: pc.text }}>{part}</h2>
        <div style={{ width: 60, height: 2, background: pc.border, margin: "0 auto" }} />
      </div>
      <p style={{ marginBottom: 18 }}>{intro}</p>
      {sample.length === 0 ? (
        <div style={{ color: "#666", fontStyle: "italic" }}>No articles in {part}.</div>
      ) : sample.map((a, i) => (
        <div key={a.id || i} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>{a.author || "—"}, "{a.title || "—"}"</div>
          <div style={{ fontStyle: "italic", color: "#555", marginBottom: 4 }}>
            {a.journal}{a.volume && `, ${a.volume}`}{a.issue && `:${a.issue}`}{a.year && ` (${a.year})`}
          </div>
          {a.abstract && (
            <div style={{ color: "#333", fontSize: 12 }}>
              {a.abstract.slice(0, 280)}{a.abstract.length > 280 ? "…" : ""}
            </div>
          )}
        </div>
      ))}
      {articles.length > 5 && (
        <div style={{ color: "#666", fontSize: 11, marginTop: 12, fontStyle: "italic" }}>
          + {articles.length - 5} more articles in this part…
        </div>
      )}
    </div>
  );
}
