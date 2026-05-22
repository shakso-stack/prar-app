// db.js — per-row data access for PRAR App.
//
// Every function in this module corresponds to a single domain operation:
// fetch a list, fetch one row, insert one row, update one or many rows,
// delete one row. The intent is that the AccessibleGrid's `onEdit(row, key,
// value)` callback maps cleanly onto these functions — one cell edit, one
// DB call.
//
// The Supabase client is configured with `db.schema = "prar"` (see
// supabase.js), so `.from("installments")` here resolves to
// `prar.installments` in the database.

import { supabase } from "./supabase";

// ─── Master journals ─────────────────────────────────────────────────────────

export async function listMasterJournals() {
  const { data, error } = await supabase
    .from("master_journals")
    .select("id, tier, journal, issn, position")
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addMasterJournal({ tier, journal, issn }) {
  const { data: maxRow } = await supabase
    .from("master_journals")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("master_journals")
    .insert({ tier, journal, issn, position: nextPosition })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMasterJournal(id, patch) {
  const { data, error } = await supabase
    .from("master_journals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMasterJournal(id) {
  const { error } = await supabase
    .from("master_journals")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function replaceAllMasterJournals(rows) {
  const { error: delErr } = await supabase
    .from("master_journals")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw delErr;

  if (rows.length === 0) return [];

  const payload = rows.map((r, i) => ({
    tier: r.tier || null,
    journal: r.journal,
    issn: r.issn || null,
    position: i,
  }));
  const { data, error } = await supabase
    .from("master_journals")
    .insert(payload)
    .select();
  if (error) throw error;
  return data;
}

// ─── Installments ────────────────────────────────────────────────────────────

export async function listInstallments() {
  const { data, error } = await supabase
    .from("installments")
    .select("id, name, installment_number, season_year, intro_override, stage, created_at, updated_at, created_by")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInstallment(id) {
  const { data, error } = await supabase
    .from("installments")
    .select("id, name, installment_number, season_year, intro_override, stage, created_at, updated_at, created_by")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Returns a map of { [installment_id]: { total, reviewed, approved } }.
// Used by the dashboard list to render per-installment progress.
//
// We pull the articles table once and group client-side. RLS lets the
// authenticated user see all rows, which matches the "any editor can see
// any installment" model in Bouquets.
export async function getInstallmentStatsMap() {
  const { data, error } = await supabase
    .from("articles")
    .select("installment_id, status");
  if (error) throw error;
  const out = {};
  for (const row of data) {
    if (!out[row.installment_id]) out[row.installment_id] = { total: 0, reviewed: 0, approved: 0 };
    const s = out[row.installment_id];
    s.total++;
    if (row.status && row.status !== "pending") s.reviewed++;
    if (row.status === "approved" || row.status === "auto-approved") s.approved++;
  }
  return out;
}

// Creates an installment row AND seeds its per-installment journal_issues
// from the current master_journals list. Seed order matches the dashboard's
// (tier, journal) sort, so Stage 1 Phase 1 shows journals in the familiar
// order rather than the raw `position` order.
export async function createInstallment({ name, installmentNumber, seasonYear, userId }) {
  const { data: inst, error: instErr } = await supabase
    .from("installments")
    .insert({
      name,
      installment_number: installmentNumber,
      season_year: seasonYear,
      created_by: userId ?? null,
    })
    .select()
    .single();
  if (instErr) throw instErr;

  // Seed journal_issues from current master_journals, sorted (tier, journal).
  const masters = await listMasterJournals();
  if (masters.length > 0) {
    const sorted = [...masters].sort((a, b) => {
      const ta = a.tier == null || a.tier === "" ? Infinity : Number(a.tier);
      const tb = b.tier == null || b.tier === "" ? Infinity : Number(b.tier);
      const taSafe = Number.isFinite(ta) ? ta : Infinity;
      const tbSafe = Number.isFinite(tb) ? tb : Infinity;
      if (taSafe !== tbSafe) return taSafe - tbSafe;
      return (a.journal || "").toLowerCase().localeCompare((b.journal || "").toLowerCase());
    });
    const seed = sorted.map((m, i) => ({
      installment_id: inst.id,
      tier: m.tier,
      journal: m.journal,
      issn: m.issn,
      position: i,
    }));
    const { error: seedErr } = await supabase.from("journal_issues").insert(seed);
    if (seedErr) throw seedErr;
  }

  return inst;
}

export async function updateInstallment(id, patch) {
  const { data, error } = await supabase
    .from("installments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInstallment(id) {
  // Cascade deletes will remove journal_issues, articles, keywords automatically.
  const { error } = await supabase
    .from("installments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Journal issues (per-installment fetch list) ─────────────────────────────

export async function listJournalIssues(installmentId) {
  const { data, error } = await supabase
    .from("journal_issues")
    .select("id, installment_id, tier, journal, issn, volume, issue, year, fetch_status, fetch_count, position")
    .eq("installment_id", installmentId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addJournalIssue(installmentId, row) {
  const { data: maxRow } = await supabase
    .from("journal_issues")
    .select("position")
    .eq("installment_id", installmentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("journal_issues")
    .insert({
      installment_id: installmentId,
      tier: row.tier ?? null,
      journal: row.journal,
      issn: row.issn ?? null,
      volume: row.volume ?? null,
      issue: row.issue ?? null,
      year: row.year ?? null,
      position: nextPosition,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJournalIssue(id, patch) {
  const { data, error } = await supabase
    .from("journal_issues")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJournalIssue(id) {
  const { error } = await supabase
    .from("journal_issues")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Articles ────────────────────────────────────────────────────────────────

export async function listArticles(installmentId) {
  const { data, error } = await supabase
    .from("articles")
    .select("id, installment_id, journal_issue_id, author, title, journal, volume, issue, year, tier, abstract, link, doi, status, part, matched_keywords, created_at")
    .eq("installment_id", installmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertArticles(installmentId, articles) {
  if (articles.length === 0) return [];
  const payload = articles.map(a => ({
    installment_id: installmentId,
    journal_issue_id: a.journal_issue_id ?? null,
    author:   a.author   ?? null,
    title:    a.title    ?? null,
    journal:  a.journal  ?? null,
    volume:   a.volume   ?? null,
    issue:    a.issue    ?? null,
    year:     a.year     ?? null,
    tier:     a.tier     ?? null,
    abstract: a.abstract ?? null,
    link:     a.link     ?? null,
    doi:      a.doi      ?? null,
    status:   a.status   ?? "pending",
    part:     a.part     ?? null,
    matched_keywords: a.matched_keywords ?? null,
  }));
  const { data, error } = await supabase
    .from("articles")
    .insert(payload)
    .select();
  if (error) throw error;
  return data;
}

export async function updateArticle(id, patch) {
  const { data, error } = await supabase
    .from("articles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Bulk update — takes an array of { id, ...patch } objects.
export async function updateArticles(updates) {
  if (updates.length === 0) return [];
  const { data, error } = await supabase
    .from("articles")
    .upsert(updates, { onConflict: "id" })
    .select();
  if (error) throw error;
  return data;
}

export async function deleteArticle(id) {
  const { error } = await supabase
    .from("articles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Delete + insert articles for a specific journal_issue. Used by Stage 1
// Phase 2 retry: the original articles for that journal_issue are dropped,
// the newly-fetched ones inserted.
export async function replaceArticlesForJournalIssue(installmentId, journalIssueId, articles) {
  const { error: delErr } = await supabase
    .from("articles")
    .delete()
    .eq("installment_id", installmentId)
    .eq("journal_issue_id", journalIssueId);
  if (delErr) throw delErr;
  return insertArticles(installmentId, articles.map(a => ({ ...a, journal_issue_id: journalIssueId })));
}

// ─── Keywords (per-installment) ──────────────────────────────────────────────

export async function listKeywords(installmentId) {
  const { data, error } = await supabase
    .from("keywords")
    .select("id, installment_id, keyword, position")
    .eq("installment_id", installmentId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addKeyword(installmentId, keyword) {
  const { data: maxRow } = await supabase
    .from("keywords")
    .select("position")
    .eq("installment_id", installmentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("keywords")
    .insert({
      installment_id: installmentId,
      keyword,
      position: nextPosition,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeKeyword(id) {
  const { error } = await supabase
    .from("keywords")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Replace the entire keyword list for an installment in one operation —
// used by the keyword panel's "Reset to Default" button, and to seed the
// initial keyword set on first entry into Stage 2.
export async function replaceKeywordsForInstallment(installmentId, keywords) {
  const { error: delErr } = await supabase
    .from("keywords")
    .delete()
    .eq("installment_id", installmentId);
  if (delErr) throw delErr;
  if (keywords.length === 0) return [];
  const payload = keywords.map((k, i) => ({
    installment_id: installmentId,
    keyword: k,
    position: i,
  }));
  const { data, error } = await supabase
    .from("keywords")
    .insert(payload)
    .select();
  if (error) throw error;
  return data;
}
