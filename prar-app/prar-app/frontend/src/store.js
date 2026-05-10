/**
 * PRAR Store
 * Primary storage: Supabase (shared across all users/devices)
 * Fallback: localStorage (if Supabase env vars not set)
 *
 * Supabase table required:
 *   Table name: prar_jobs
 *   Columns:
 *     id          text  primary key
 *     data        jsonb
 *     created_at  timestamptz default now()
 *     updated_at  timestamptz default now()
 *
 * Supabase table required:
 *   Table name: prar_settings
 *   Columns:
 *     key         text  primary key
 *     value       jsonb
 */

import { supabase, supabaseReady } from "./supabase";

const LS_JOBS_KEY     = "prar_jobs";
const LS_JOURNALS_KEY = "prar_master_journals";

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function loadJobsAsync() {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from("prar_jobs")
      .select("id, data, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Supabase loadJobs error:", error);
      return [];
    }
    return data.map(row => ({ ...row.data, id: row.id }));
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(LS_JOBS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveJobAsync(job) {
  if (supabaseReady) {
    const { error } = await supabase
      .from("prar_jobs")
      .upsert({
        id: job.id,
        data: job,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    if (error) console.error("Supabase saveJob error:", error);
    return;
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(LS_JOBS_KEY);
    const jobs = raw ? JSON.parse(raw) : [];
    const idx = jobs.findIndex(j => j.id === job.id);
    if (idx >= 0) jobs[idx] = job; else jobs.unshift(job);
    localStorage.setItem(LS_JOBS_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.error("localStorage saveJob error:", e);
  }
}

export async function deleteJobAsync(jobId) {
  if (supabaseReady) {
    const { error } = await supabase
      .from("prar_jobs")
      .delete()
      .eq("id", jobId);
    if (error) console.error("Supabase deleteJob error:", error);
    return;
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(LS_JOBS_KEY);
    const jobs = raw ? JSON.parse(raw) : [];
    localStorage.setItem(LS_JOBS_KEY, JSON.stringify(jobs.filter(j => j.id !== jobId)));
  } catch (e) {
    console.error("localStorage deleteJob error:", e);
  }
}

// ─── Master journals ──────────────────────────────────────────────────────────

export async function loadMasterJournalsAsync(defaultJournals) {
  if (supabaseReady) {
    const { data, error } = await supabase
      .from("prar_settings")
      .select("value")
      .eq("key", "master_journals")
      .single();
    if (error || !data) return defaultJournals;
    return data.value;
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(LS_JOURNALS_KEY);
    return raw ? JSON.parse(raw) : defaultJournals;
  } catch {
    return defaultJournals;
  }
}

export async function saveMasterJournalsAsync(journals) {
  if (supabaseReady) {
    const { error } = await supabase
      .from("prar_settings")
      .upsert({ key: "master_journals", value: journals }, { onConflict: "key" });
    if (error) console.error("Supabase saveMasterJournals error:", error);
    return;
  }
  // localStorage fallback
  localStorage.setItem(LS_JOURNALS_KEY, JSON.stringify(journals));
}

// ─── Synchronous helpers (kept for non-async contexts) ────────────────────────

export function loadMasterJournals(defaultJournals) {
  try {
    const raw = localStorage.getItem(LS_JOURNALS_KEY);
    return raw ? JSON.parse(raw) : defaultJournals;
  } catch {
    return defaultJournals;
  }
}

export function saveMasterJournals(journals) {
  localStorage.setItem(LS_JOURNALS_KEY, JSON.stringify(journals));
}

export function resetMasterJournals(defaultJournals) {
  localStorage.setItem(LS_JOURNALS_KEY, JSON.stringify(defaultJournals));
  return defaultJournals;
}

// ─── Job helpers ──────────────────────────────────────────────────────────────

export function createJob(name, installmentNumber, seasonYear, masterJournals) {
  return {
    id: Date.now().toString(),
    name,
    installmentNumber,
    seasonYear,
    stage: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    journalIssues: masterJournals.map((j, i) => ({
      id: i + 1, ...j, volume: "", issue: "", year: "",
    })),
    articles: [],
  };
}

export function updateJob(jobs, jobId, updates) {
  return jobs.map((j) =>
    j.id === jobId ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j
  );
}

export function deleteJob(jobs, jobId) {
  return jobs.filter((j) => j.id !== jobId);
}

export function exportJob(job) {
  const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${job.name.replace(/\s+/g, "_")}_backup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJob(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const job = JSON.parse(e.target.result);
      job.id = Date.now().toString();
      onSuccess(job);
    } catch {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(file);
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function stageLabel(stage) {
  const labels = {
    1: "Stage 1 — Fetch Articles",
    2: "Stage 2 — Review",
    3: "Stage 3 — Compile",
    4: "Stage 4 — Generate",
    5: "Stage 5 — Download",
  };
  return labels[stage] || "Unknown Stage";
}
