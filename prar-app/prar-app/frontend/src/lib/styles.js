// Visual constants for PRAR App.
//
// Same token names as Bouquets' styles.js, but with the PRAR App dark
// palette. This lets the ported AccessibleGrid (and any other Bouquets
// components) import COLORS / FONTS / styles unchanged.
//
// "Premium-look" pass applied:
//   - bgPage desaturated from #1a0f0a to #18120e (still warm-dark, red note
//     dropped a touch).
//   - Gold split into `gold` (primary CTA) and `goldMuted` (labels, borders).
//   - Hairline borders use rgba gold at 12% alpha instead of brown.
//   - Card shadows for subtle depth.
//   - Progress-bar circle size reduced from 28px to 22px (consumed by
//     Dashboard).

export const COLORS = {
  // Backgrounds
  bgPage:       "#18120e",     // body — desaturated warm-dark (was #1a0f0a)
  bgPanel:      "#241712",     // elevated card surface (was #2c1810)
  bgPanelAlt:   "#1e1410",     // for striped rows
  bgPanelDeep:  "#120c08",     // even darker — sticky headers, inputs

  // Navigation & dark anchors (legacy aliases for ported code)
  navDark:      "#241712",
  navDarkSoft:  "#2d1c14",

  // Gold accent — split into primary and muted
  gold:         "#d4af7a",     // primary CTA gold (unchanged)
  goldHi:       "#e6c89a",     // hover / highlight
  goldDeep:     "#b8945e",     // emphatic (used for "done" states)
  goldMuted:    "rgba(212,175,122,0.55)",   // labels, secondary text
  goldSoft:     "rgba(212,175,122,0.18)",   // soft chip backgrounds
  goldRule:     "linear-gradient(to right, transparent, #d4af7a 20%, #d4af7a 80%, transparent)",

  // Borders — hairlines
  borderSoft:   "rgba(212,175,122,0.15)",   // panel and grid lines (was #5a3a28)
  borderHair:   "rgba(212,175,122,0.10)",   // even subtler, between rows
  borderInput:  "rgba(212,175,122,0.35)",   // input fields
  borderFocus:  "#d4af7a",                  // focus ring

  // Text
  textBody:     "#f0e6d8",                  // primary body text on dark
  textMuted:    "rgba(240,230,216,0.55)",   // secondary
  textFaint:    "rgba(240,230,216,0.30)",   // hint text
  textOnDark:   "#f0e6d8",                  // alias
  textOnGold:   "#241712",                  // text on gold-button backgrounds

  // Semantic (calibrated for dark backgrounds)
  danger:       "#e07c7c",
  dangerSoft:   "rgba(224,124,124,0.12)",
  success:      "#7cbf99",
  successSoft:  "rgba(124,191,153,0.12)",
  warning:      "#e8b573",
  warningSoft:  "rgba(232,181,115,0.12)",
  info:         "#85b3d4",
  infoSoft:     "rgba(133,179,212,0.12)",

  // Shadows — subtle on dark
  shadowSoft:   "0 1px 3px rgba(0,0,0,0.30), 0 4px 14px rgba(0,0,0,0.20)",
  shadowHover:  "0 2px 6px rgba(0,0,0,0.35), 0 8px 22px rgba(0,0,0,0.25)",
  shadowDeep:   "0 6px 32px rgba(0,0,0,0.55)",
};

export const FONTS = {
  serif:   '"Crimson Text", Georgia, "Times New Roman", serif',
  display: '"Cormorant Garamond", "Crimson Text", Georgia, serif',
};

export const styles = {
  // ─── Layout ───────────────────────────────────────────────────────────────
  page:       { padding: "32px 36px 48px", maxWidth: 1180, margin: "0 auto" },
  pageNarrow: { padding: "32px 36px 48px", maxWidth: 780,  margin: "0 auto" },

  // ─── Headings ─────────────────────────────────────────────────────────────
  h1: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 30,
    fontWeight: 500,
    margin: "0 0 6px",
    letterSpacing: "0.4px",
  },
  h2: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: 500,
    margin: "0 0 4px",
    letterSpacing: "0.3px",
  },
  h3: {
    color: COLORS.textBody,
    fontFamily: FONTS.serif,
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 14px",
    letterSpacing: "0.2px",
  },

  goldRule: {
    height: 2,
    width: 80,
    background: COLORS.gold,
    margin: "0 0 22px 0",
    borderRadius: 1,
  },

  // ─── Cards ────────────────────────────────────────────────────────────────
  card: {
    background: COLORS.bgPanel,
    border: `1px solid ${COLORS.borderSoft}`,
    borderRadius: 10,
    padding: "24px 28px",
    marginBottom: 18,
    boxShadow: COLORS.shadowSoft,
  },
  cardCompact: {
    background: COLORS.bgPanel,
    border: `1px solid ${COLORS.borderSoft}`,
    borderRadius: 8,
    padding: "14px 18px",
    marginBottom: 12,
    boxShadow: COLORS.shadowSoft,
  },

  // ─── Inputs ───────────────────────────────────────────────────────────────
  input: {
    fontFamily: FONTS.serif,
    fontSize: 14,
    padding: "9px 13px",
    border: `1px solid ${COLORS.borderInput}`,
    borderRadius: 5,
    background: COLORS.bgPanelDeep,
    color: COLORS.textBody,
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  textarea: {
    fontFamily: FONTS.serif,
    fontSize: 14,
    padding: "9px 13px",
    border: `1px solid ${COLORS.borderInput}`,
    borderRadius: 5,
    background: COLORS.bgPanelDeep,
    color: COLORS.textBody,
    width: "100%",
    minHeight: 90,
    resize: "vertical",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    fontSize: 11,
    color: COLORS.goldMuted,
    marginBottom: 5,
    fontFamily: FONTS.serif,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.7px",
  },

  // ─── Buttons ──────────────────────────────────────────────────────────────
  btnPrimary: {
    background: `linear-gradient(180deg, ${COLORS.goldHi} 0%, ${COLORS.gold} 100%)`,
    color: COLORS.textOnGold,
    border: "none",
    padding: "9px 22px",
    borderRadius: 5,
    fontFamily: FONTS.serif,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.3px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
    transition: "transform 0.1s ease, box-shadow 0.15s ease",
  },
  btnOutline: {
    background: "transparent",
    color: COLORS.gold,
    border: `1px solid ${COLORS.gold}`,
    padding: "8px 20px",
    borderRadius: 5,
    fontFamily: FONTS.serif,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
  btnDanger: {
    background: "transparent",
    color: COLORS.danger,
    border: `1px solid ${COLORS.danger}`,
    padding: "7px 16px",
    borderRadius: 5,
    fontFamily: FONTS.serif,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSubtle: {
    background: "transparent",
    color: COLORS.textMuted,
    border: `1px solid ${COLORS.borderSoft}`,
    padding: "7px 16px",
    borderRadius: 5,
    fontFamily: FONTS.serif,
    fontSize: 13,
    cursor: "pointer",
  },
  btnGold: {  // alias for btnPrimary, kept for portability with Bouquets code
    background: `linear-gradient(180deg, ${COLORS.goldHi} 0%, ${COLORS.gold} 100%)`,
    color: COLORS.textOnGold,
    border: "none",
    padding: "9px 22px",
    borderRadius: 5,
    fontFamily: FONTS.serif,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.3px",
  },

  // ─── Chips ────────────────────────────────────────────────────────────────
  chip: (kind = "neutral") => {
    const map = {
      pending:  { bg: COLORS.warningSoft, color: COLORS.warning, border: "rgba(232,181,115,0.40)" },
      included: { bg: COLORS.successSoft, color: COLORS.success, border: "rgba(124,191,153,0.40)" },
      excluded: { bg: COLORS.dangerSoft,  color: COLORS.danger,  border: "rgba(224,124,124,0.40)" },
      neutral:  { bg: COLORS.goldSoft,    color: COLORS.gold,    border: "rgba(212,175,122,0.40)" },
    };
    const c = map[kind] || map.neutral;
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      fontFamily: FONTS.serif,
      fontSize: 12,
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      letterSpacing: "0.3px",
    };
  },

  // ─── Banners ──────────────────────────────────────────────────────────────
  banner: (kind = "info") => {
    const map = {
      info:    { bg: COLORS.infoSoft,    border: COLORS.info,    color: "#bcd6e8" },
      success: { bg: COLORS.successSoft, border: COLORS.success, color: "#b6dcc4" },
      warning: { bg: COLORS.warningSoft, border: COLORS.warning, color: "#f0d3a8" },
      error:   { bg: COLORS.dangerSoft,  border: COLORS.danger,  color: "#f0b6b6" },
    };
    const c = map[kind] || map.info;
    return {
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderLeft: `4px solid ${c.border}`,
      color: c.color,
      borderRadius: 5,
      padding: "12px 16px",
      fontSize: 14,
      marginBottom: 16,
      fontFamily: FONTS.serif,
    };
  },
};
