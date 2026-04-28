import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Stage1 from "./components/Stage1";
import Stage2 from "./components/Stage2";
import Stage3 from "./components/Stage3";
import Stage4 from "./components/Stage4";
import Stage5 from "./components/Stage5";
import { loadJobs, saveJobs, updateJob } from "./store";

export default function App() {
  const [jobs, setJobs] = useState(() => loadJobs());
  const [activeJobId, setActiveJobId] = useState(null);

  useEffect(() => {
    saveJobs(jobs);
  }, [jobs]);

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  function setJobs_(next) {
    setJobs(next);
  }

  function updateActiveJob(updates) {
    setJobs_((prev) => updateJob(prev, activeJobId, updates));
  }

  function goToStage(stage) {
    updateActiveJob({ stage });
  }

  if (!activeJob) {
    return (
      <Dashboard
        jobs={jobs}
        setJobs={setJobs_}
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
      <StageNav job={activeJob} goToStage={goToStage} onBack={() => setActiveJobId(null)} />
      {activeJob.stage === 1 && <Stage1 {...stageProps} />}
      {activeJob.stage === 2 && <Stage2 {...stageProps} />}
      {activeJob.stage === 3 && <Stage3 {...stageProps} />}
      {activeJob.stage === 4 && <Stage4 {...stageProps} />}
      {activeJob.stage === 5 && <Stage5 {...stageProps} />}
    </div>
  );
}

function StageNav({ job, goToStage, onBack }) {
  const stages = [
    { n: 1, label: "Fetch" },
    { n: 2, label: "Review" },
    { n: 3, label: "Compile" },
    { n: 4, label: "Generate" },
    { n: 5, label: "Download" },
  ];
  return (
    <div style={{
      background: "#2c1810",
      padding: "10px 24px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <button onClick={onBack} style={{
        background: "none", border: "1px solid rgba(255,255,255,0.3)",
        color: "#d4af7a", padding: "4px 12px", borderRadius: 4,
        cursor: "pointer", fontFamily: "Crimson Text, serif", fontSize: 13,
      }}>← Dashboard</button>
      <span style={{ color: "#d4af7a", fontFamily: "Crimson Text, serif", fontSize: 14, marginRight: 8 }}>
        {job.name}
      </span>
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
    </div>
  );
}
