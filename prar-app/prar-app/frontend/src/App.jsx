import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Stage1 from "./components/Stage1";
import Stage2 from "./components/Stage2";
import Stage3 from "./components/Stage3";
import Stage4 from "./components/Stage4";
import Stage5 from "./components/Stage5";
import SignIn from "./components/SignIn";
import {
  loadJobsAsync, saveJobAsync, deleteJobAsync,
  loadMasterJournalsAsync, saveMasterJournalsAsync,
  updateJob, deleteJob, loadMasterJournals, saveMasterJournals,
} from "./store";
import { JOURNALS } from "./data";
import { useAuth, signOut } from "./lib/auth";

export default function App() {
  const { session, user, loading: authLoading } = useAuth();

  // ─── Sign-in gate ──────────────────────────────────────────────────────
  // Until A2–A8 migrate the rest of the app to the new schema, the
  // existing localStorage/legacy-supabase flow continues to power the
  // dashboard and stages. Auth only gates whether the user sees them.

  if (authLoading) {
    return <FullScreenLoader message="Loading…" />;
  }

  if (!session) {
    return <SignIn />;
  }

  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }) {
  const [jobs, setJobs] = useState([]);
  const [masterJournals, setMasterJournals] = useState(() => loadMasterJournals(JOURNALS));
  const [activeJobId, setActiveJobId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load jobs and master journals on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [loadedJobs, loadedJournals] = await Promise.all([
        loadJobsAsync(),
        loadMasterJournalsAsync(JOURNALS),
      ]);
      setJobs(loadedJobs);
      setMasterJournals(loadedJournals);
      setLoading(false);
    }
    init();
  }, []);

  // Save master journals whenever they change
  useEffect(() => {
    saveMasterJournalsAsync(masterJournals);
    saveMasterJournals(masterJournals); // keep localStorage in sync as backup
  }, [masterJournals]);

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  async function handleSetJobs(nextJobs) {
    if (Array.isArray(nextJobs)) {
      if (nextJobs.length < jobs.length) {
        const removedId = jobs.find(j => !nextJobs.find(nj => nj.id === j.id))?.id;
        if (removedId) await deleteJobAsync(removedId);
      }
      setJobs(nextJobs);
    }
  }

  async function addJob(job) {
    await saveJobAsync(job);
    setJobs(prev => [job, ...prev]);
  }

  async function updateActiveJob(updates) {
    const updatedJobs = updateJob(jobs, activeJobId, updates);
    setJobs(updatedJobs);
    const updatedJob = updatedJobs.find(j => j.id === activeJobId);
    if (updatedJob) await saveJobAsync(updatedJob);
  }

  async function removeJob(jobId) {
    await deleteJobAsync(jobId);
    setJobs(prev => deleteJob(prev, jobId));
  }

  function goToStage(stage) {
    updateActiveJob({ stage });
  }

  if (loading) {
    return <FullScreenLoader message="Loading installments…" />;
  }

  if (!activeJob) {
    return (
      <Dashboard
        jobs={jobs}
        setJobs={handleSetJobs}
        addJob={addJob}
        removeJob={removeJob}
        masterJournals={masterJournals}
        setMasterJournals={setMasterJournals}
        onOpen={(id) => setActiveJobId(id)}
      />
    );
  }

  const stageProps = {
    job: activeJob,
    updateJob: updateActiveJob,
    goToStage,
    onBack: () => setActiveJobId(null),
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f6f1" }}>
      <StageNav
        job={activeJob}
        goToStage={goToStage}
        onBack={() => setActiveJobId(null)}
        user={user}
        onSignOut={signOut}
      />
      {activeJob.stage === 1 && <Stage1 {...stageProps} />}
      {activeJob.stage === 2 && <Stage2 {...stageProps} />}
      {activeJob.stage === 3 && <Stage3 {...stageProps} />}
      {activeJob.stage === 4 && <Stage4 {...stageProps} />}
      {activeJob.stage === 5 && <Stage5 {...stageProps} />}
    </div>
  );
}

function FullScreenLoader({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh", background: "#1a0f0a",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 48, height: 48,
          border: "3px solid #d4af7a", borderTopColor: "transparent",
          borderRadius: "50%", animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 16 }}>
        {message}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StageNav({ job, goToStage, onBack, user, onSignOut }) {
  const stages = [
    { n: 1, label: "Fetch" }, { n: 2, label: "Review" }, { n: 3, label: "Compile" },
    { n: 4, label: "Generate" }, { n: 5, label: "Download" },
  ];
  return (
    <div style={{ background: "#2c1810", padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.3)", position: "sticky", top: 0, zIndex: 100 }}>
      <button onClick={onBack} style={navBtn}>← Dashboard</button>
      <span style={{ color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 14, marginRight: 8 }}>{job.name}</span>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {stages.map(({ n, label }) => {
          const done = job.stage > n;
          const active = job.stage === n;
          const reachable = n <= job.stage;
          return (
            <button key={n} onClick={() => reachable && goToStage(n)} style={{
              padding: "4px 14px", borderRadius: 4, fontSize: 12,
              fontFamily: "Crimson Text, serif", cursor: reachable ? "pointer" : "default",
              border: active ? "1px solid #d4af7a" : "1px solid rgba(255,255,255,0.15)",
              background: active ? "#d4af7a" : done ? "rgba(212,175,122,0.2)" : "transparent",
              color: active ? "#2c1810" : done ? "#d4af7a" : "rgba(255,255,255,0.4)",
              fontWeight: active ? 600 : 400,
            }}>
              {done ? "✓ " : ""}{n}. {label}
            </button>
          );
        })}
      </div>
      <UserMenu user={user} onSignOut={onSignOut} />
    </div>
  );
}

function UserMenu({ user, onSignOut }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
      <span style={{ color: "rgba(212,175,122,0.7)", fontFamily: "Crimson Text, serif", fontSize: 12 }}>
        {user?.email}
      </span>
      <button onClick={onSignOut} style={navBtn}>Sign out</button>
    </div>
  );
}

const navBtn = {
  background: "none",
  border: "1px solid rgba(255,255,255,0.3)",
  color: "#d4af7a",
  padding: "4px 12px",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "Crimson Text, serif",
  fontSize: 13,
};
