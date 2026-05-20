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
  // New journals go to the end of the list.
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

// Replace the entire master_journals list in one operation. Used by the
// dashboard's Manage Journal List panel's "Save as Default" button when
// the editor has made many row-level changes locally and wants to commit
// them all at once. Implemented as: delete-all, then bulk insert with
// fresh positions.
export async function replaceAllMasterJournals(rows) {
  // First clear. RLS lets authenticated users do this.
  const { error: delErr } = await supabase
    .from("master_journals")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete every row
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

// Creates an installment row AND seeds its per-installment journal_issues
// from the current master_journals list. Returns the created installment.
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

  // Seed journal_issues from current master_journals.
  const masters = await listMasterJournals();
  if (masters.length > 0) {
    const seed = masters.map((m, i) => ({
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
    .select("id, installment_id, journal_issue_id, author, title, journal, volume, issue, year, tier, abstract, link, doi, status, part, matched_keywords")
    .eq("installment_id", installmentId)
    .order("journal", { ascending: true })
    .order("title", { ascending: true });
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

// Bulk update — used by Stage 2's "Set all shown to Excluded" and similar.
// Takes an array of { id, ...patch } objects. Performs one upsert call,
// returning all updated rows.
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

// Replace the article pool for an installment — used when re-fetching from
// Stage 1 Phase 1 after review work has been done (deletes existing articles
// for the installment, then inserts the new set).
export async function replaceArticlesForInstallment(installmentId, articles) {
  const { error: delErr } = await supabase
    .from("articles")
    .delete()
    .eq("installment_id", installmentId);
  if (delErr) throw delErr;
  return insertArticles(installmentId, articles);
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
// used by the Keyword panel's "Reset to Default" button.
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
