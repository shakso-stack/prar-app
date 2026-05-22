// Backup export / import for PRAR App installments.
//
// Export shape (the "new shape" — option (b) in the planning discussion):
//
//   {
//     "format": "prar-installment-v1",
//     "exported_at": "<ISO timestamp>",
//     "installment": { name, installment_number, season_year, intro_override, stage },
//     "journal_issues": [ { _position, tier, journal, issn, volume, issue, year,
//                            fetch_status, fetch_count } ],
//     "articles": [ { _journal_issue_position, author, title, journal, volume,
//                      issue, year, tier, abstract, link, doi, status, part,
//                      matched_keywords } ],
//     "keywords": [ { _position, keyword } ]
//   }
//
// Positional references (_position, _journal_issue_position) replace DB UUIDs
// so that the file is portable: any user can import it into any installment.
// During import, fresh UUIDs are generated and the positional refs are mapped
// to the new UUIDs.

import { supabase } from "./supabase";
import { listInstallments } from "./db";

const FORMAT = "prar-installment-v1";

// ─── Export ─────────────────────────────────────────────────────────────────

// Loads everything for an installment and serializes it.
export async function exportInstallment(installmentId) {
  // Fetch installment + all children in parallel.
  const [instRes, issuesRes, articlesRes, keywordsRes] = await Promise.all([
    supabase.from("installments")
      .select("name, installment_number, season_year, intro_override, stage")
      .eq("id", installmentId)
      .single(),
    supabase.from("journal_issues")
      .select("id, tier, journal, issn, volume, issue, year, fetch_status, fetch_count, position")
      .eq("installment_id", installmentId)
      .order("position", { ascending: true }),
    supabase.from("articles")
      .select("journal_issue_id, author, title, journal, volume, issue, year, tier, abstract, link, doi, status, part, matched_keywords")
      .eq("installment_id", installmentId),
    supabase.from("keywords")
      .select("keyword, position")
      .eq("installment_id", installmentId)
      .order("position", { ascending: true }),
  ]);

  if (instRes.error)     throw instRes.error;
  if (issuesRes.error)   throw issuesRes.error;
  if (articlesRes.error) throw articlesRes.error;
  if (keywordsRes.error) throw keywordsRes.error;

  // Build journal_issue UUID → position map for article foreign keys.
  const idToPosition = {};
  for (const ji of issuesRes.data) idToPosition[ji.id] = ji.position;

  return {
    format: FORMAT,
    exported_at: new Date().toISOString(),
    installment: {
      name: instRes.data.name,
      installment_number: instRes.data.installment_number,
      season_year: instRes.data.season_year,
      intro_override: instRes.data.intro_override,
      stage: instRes.data.stage,
    },
    journal_issues: issuesRes.data.map(ji => ({
      _position:    ji.position,
      tier:         ji.tier,
      journal:      ji.journal,
      issn:         ji.issn,
      volume:       ji.volume,
      issue:        ji.issue,
      year:         ji.year,
      fetch_status: ji.fetch_status,
      fetch_count:  ji.fetch_count,
    })),
    articles: articlesRes.data.map(a => ({
      _journal_issue_position: a.journal_issue_id != null
        ? idToPosition[a.journal_issue_id] ?? null
        : null,
      author:           a.author,
      title:            a.title,
      journal:          a.journal,
      volume:           a.volume,
      issue:            a.issue,
      year:             a.year,
      tier:             a.tier,
      abstract:         a.abstract,
      link:             a.link,
      doi:              a.doi,
      status:           a.status,
      part:             a.part,
      matched_keywords: a.matched_keywords,
    })),
    keywords: keywordsRes.data.map(k => ({
      _position: k.position,
      keyword:   k.keyword,
    })),
  };
}

// Trigger a download in the browser.
export function downloadAsJsonFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ─────────────────────────────────────────────────────────────────

// Validates the backup file shape without writing anything.
// Returns { ok: true, summary: {…} } or { ok: false, error: "…" }.
export function validateBackup(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "File is not valid JSON." };
  }
  if (data.format !== FORMAT) {
    return { ok: false, error: `Unsupported format: "${data.format ?? "(missing)"}". Expected "${FORMAT}".` };
  }
  if (!data.installment || typeof data.installment !== "object") {
    return { ok: false, error: "Missing installment metadata." };
  }
  const inst = data.installment;
  if (typeof inst.name !== "string" || !inst.name.trim()) {
    return { ok: false, error: "Installment name is missing or empty." };
  }
  if (typeof inst.installment_number !== "number" || !Number.isInteger(inst.installment_number) || inst.installment_number < 1) {
    return { ok: false, error: "Installment number is missing or invalid." };
  }
  if (typeof inst.season_year !== "string" || !inst.season_year.trim()) {
    return { ok: false, error: "Season/year is missing or empty." };
  }
  if (!Array.isArray(data.journal_issues)) {
    return { ok: false, error: "journal_issues must be an array." };
  }
  if (!Array.isArray(data.articles)) {
    return { ok: false, error: "articles must be an array." };
  }
  if (!Array.isArray(data.keywords)) {
    return { ok: false, error: "keywords must be an array." };
  }

  // Verify article positional refs land on a real journal_issue (or null).
  const positions = new Set(data.journal_issues.map(ji => ji._position));
  for (const a of data.articles) {
    const ref = a._journal_issue_position;
    if (ref != null && !positions.has(ref)) {
      return { ok: false, error: `Article references unknown journal_issue position ${ref}.` };
    }
  }

  return {
    ok: true,
    summary: {
      name: inst.name,
      installmentNumber: inst.installment_number,
      seasonYear: inst.season_year,
      stage: inst.stage ?? 1,
      journalIssueCount: data.journal_issues.length,
      articleCount: data.articles.length,
      keywordCount: data.keywords.length,
      hasIntroOverride: !!inst.intro_override,
    },
  };
}

// Imports a validated backup. Creates a new installment row with a fresh UUID
// (the caller can rename it first if there's a collision with an existing one).
// Returns the newly-created installment row.
//
// `nameOverride` is optional — used when the user picks a different name to
// avoid a conflict with an existing installment.
export async function importInstallment(data, userId, nameOverride = null) {
  const valid = validateBackup(data);
  if (!valid.ok) throw new Error(valid.error);

  const inst = data.installment;
  const name = (nameOverride || inst.name).trim();

  // Insert the installment row.
  const { data: created, error: instErr } = await supabase
    .from("installments")
    .insert({
      name,
      installment_number: inst.installment_number,
      season_year: inst.season_year.trim(),
      intro_override: inst.intro_override ?? null,
      stage: typeof inst.stage === "number" ? inst.stage : 1,
      created_by: userId ?? null,
    })
    .select()
    .single();
  if (instErr) throw instErr;

  // Insert journal_issues. Collect returned UUIDs by position.
  let issuesByPosition = {};
  if (data.journal_issues.length > 0) {
    const payload = data.journal_issues.map(ji => ({
      installment_id: created.id,
      tier:           ji.tier ?? null,
      journal:        ji.journal,
      issn:           ji.issn ?? null,
      volume:         ji.volume ?? null,
      issue:          ji.issue ?? null,
      year:           ji.year ?? null,
      fetch_status:   ji.fetch_status ?? null,
      fetch_count:    ji.fetch_count ?? null,
      position:       ji._position,
    }));
    const { data: created_issues, error: issErr } = await supabase
      .from("journal_issues")
      .insert(payload)
      .select("id, position");
    if (issErr) throw issErr;
    for (const row of created_issues) issuesByPosition[row.position] = row.id;
  }

  // Insert articles. Map _journal_issue_position back to the fresh UUIDs.
  if (data.articles.length > 0) {
    const payload = data.articles.map(a => ({
      installment_id:    created.id,
      journal_issue_id:  a._journal_issue_position != null
                          ? issuesByPosition[a._journal_issue_position] ?? null
                          : null,
      author:            a.author ?? null,
      title:             a.title ?? null,
      journal:           a.journal ?? null,
      volume:            a.volume ?? null,
      issue:             a.issue ?? null,
      year:              a.year ?? null,
      tier:              a.tier ?? null,
      abstract:          a.abstract ?? null,
      link:              a.link ?? null,
      doi:               a.doi ?? null,
      status:            a.status ?? "pending",
      part:              a.part ?? null,
      matched_keywords:  a.matched_keywords ?? null,
    }));
    const { error: artErr } = await supabase
      .from("articles")
      .insert(payload);
    if (artErr) throw artErr;
  }

  // Insert keywords.
  if (data.keywords.length > 0) {
    const payload = data.keywords.map(k => ({
      installment_id: created.id,
      keyword:        k.keyword,
      position:       k._position,
    }));
    const { error: kwErr } = await supabase
      .from("keywords")
      .insert(payload);
    if (kwErr) throw kwErr;
  }

  return created;
}

// Helper: returns true if an installment with this exact name already exists.
export async function installmentNameExists(name) {
  const all = await listInstallments();
  return all.some(i => i.name === name);
}

// Helper: suggest a non-colliding name like "Foo (imported)" or "Foo (imported 2)".
export async function suggestImportName(originalName) {
  const all = await listInstallments();
  const existing = new Set(all.map(i => i.name));
  if (!existing.has(originalName)) return originalName;
  const base = `${originalName} (imported)`;
  if (!existing.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${originalName} (imported ${i})`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${originalName} (imported ${Date.now()})`;
}
