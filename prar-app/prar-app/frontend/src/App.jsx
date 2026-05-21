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
  updateJob, deleteJob,
} from "./store";
import { listMasterJournals } from "./lib/db";
import { useAuth, signOut } from "./lib/auth";
import { COLORS, FONTS } from "./lib/styles";

export default function App() {
  const { session, user, loading: authLoading } = useAuth();

  if (authLoading) return <FullScreenLoader message="Loading…" />;
  if (!session)   return <SignIn />;

  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }) {
  const [jobs, setJobs] = useState([]);
  const [masterJournals, setMasterJournals] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Load jobs (still legacy) and master journals (DB) on mount.
  useEffect(() => {
    async function init() {
      setLoading(true);
      setLoadError("");
      try {
        const [loadedJobs, loadedJournals] = await Promise.all([
          loadJobsAsync(),
          listMasterJournals(),
        ]);
        setJobs(loadedJobs);
        setMasterJournals(loadedJournals);
      } catch (err) {
        setLoadError(err.message || "Could not load data.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

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

  if (loading) return <FullScreenLoader message="Loading installments…" />;

  if (loadError) {
    return (
      <div style={{
        minHeight: "100vh", background: COLORS.bgPage,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
        fontFamily: FONTS.serif,
      }}>
        <div style={{ color: COLORS.danger, fontSize: 16, maxWidth: 480, textAlign: "center" }}>
          {loadError}
        </div>
        <button onClick={() => window.location.reload()} style={{
          background: COLORS.gold, color: COLORS.textOnGold,
          border: "none", padding: "9px 22px", borderRadius: 5,
          fontFamily: FONTS.serif, fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Reload</button>
      </div>
    );
  }

  if (!activeJob) {
    return (
      <>
        <TopBar user={user} onSignOut={signOut} />
        <Dashboard
          jobs={jobs}
          setJobs={handleSetJobs}
          addJob={addJob}
          removeJob={removeJob}
          masterJournals={masterJournals}
          setMasterJournals={setMasterJournals}
          onOpen={(id) => setActiveJobId(id)}
        />
      </>
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
        minHeight: "100vh", background: COLORS.bgPage,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44, height: 44,
          border: `3px solid ${COLORS.gold}`, borderTopColor: "transparent",
          borderRadius: "50%", animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ color: COLORS.gold, fontFamily: FONTS.serif, fontSize: 15 }}>
        {message}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Top bar on the dashboard. The original UI had no top bar there — the sign-out
// only appeared inside StageNav. Adding a minimal one so users can sign out from
// the dashboard too.
function TopBar({ user, onSignOut }) {
  return (
    <div style={{
      background: COLORS.bgPanel, padding: "8px 24px",
      display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14,
      borderBottom: `1px solid ${COLORS.borderSoft}`,
      fontFamily: FONTS.serif,
    }}>
      <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{user?.email}</span>
      <button onClick={onSignOut} style={{
        background: "none",
        border: `1px solid ${COLORS.goldMuted}`,
        color: COLORS.gold,
        padding: "4px 12px", borderRadius: 4,
        cursor: "pointer", fontFamily: FONTS.serif, fontSize: 12,
      }}>Sign out</button>
    </div>
  );
}

function StageNav({ job, goToStage, onBack, user, onSignOut }) {
  const stages = [
    { n: 1, label: "Fetch" }, { n: 2, label: "Review" }, { n: 3, label: "Compile" },
    { n: 4, label: "Generate" }, { n: 5, label: "Download" },
  ];
  return (
    <div style={{
      background: COLORS.bgPanel, padding: "10px 24px",
      display: "flex", alignItems: "center", gap: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      position: "sticky", top: 0, zIndex: 100,
      borderBottom: `1px solid ${COLORS.borderSoft}`,
    }}>
      <button onClick={onBack} style={navBtn}>← Dashboard</button>
      <span style={{ color: COLORS.gold, fontFamily: FONTS.serif, fontSize: 14, marginRight: 8 }}>{job.name}</span>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {stages.map(({ n, label }) => {
          const done = job.stage > n;
          const active = job.stage === n;
          const reachable = n <= job.stage;
          return (
            <button key={n} onClick={() => reachable && goToStage(n)} style={{
              padding: "4px 14px", borderRadius: 4, fontSize: 12,
              fontFamily: FONTS.serif, cursor: reachable ? "pointer" : "default",
              border: active ? `1px solid ${COLORS.gold}` : `1px solid ${COLORS.borderHair}`,
              background: active ? COLORS.gold : done ? COLORS.goldSoft : "transparent",
              color: active ? COLORS.textOnGold : done ? COLORS.gold : COLORS.textFaint,
              fontWeight: active ? 700 : 400,
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
      <span style={{ color: COLORS.goldMuted, fontFamily: FONTS.serif, fontSize: 12 }}>
        {user?.email}
      </span>
      <button onClick={onSignOut} style={navBtn}>Sign out</button>
    </div>
  );
}

const navBtn = {
  background: "none",
  border: `1px solid ${COLORS.goldMuted}`,
  color: COLORS.gold,
  padding: "4px 12px",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: FONTS.serif,
  fontSize: 13,
};
