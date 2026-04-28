const STORAGE_KEY = "prar_jobs";

export function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function createJob(name, installmentNumber, seasonYear) {
  return {
    id: Date.now().toString(),
    name,
    installmentNumber,
    seasonYear,
    stage: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    journalIssues: [],
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
