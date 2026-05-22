import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import Stage1 from "./components/Stage1";
import Stage2 from "./components/Stage2";
import Stage3 from "./components/Stage3";
import Stage4 from "./components/Stage4";
import Stage5 from "./components/Stage5";
import SignIn from "./components/SignIn";
import {
  listInstallments, listMasterJournals, getInstallment, updateInstallment,
} from "./lib/db";
import { useAuth, signOut } from "./lib/auth";
import { COLORS, FONTS } from "./lib/styles";

export default function App() {
  const { session, user, loading: authLoading } = useAuth();

  if (authLoading) return <FullScreenLoader message="Loading…" />;
  if (!session)   return <SignIn />;

  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }) {
  const [installments, setInstallments] = useState([]);
  const [masterJournals, setMasterJournals] = useState([]);
  const [activeInstallmentId, setActiveInstallmentId] = useState(null);
  const [activeInstallment, setActiveInstallment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Initial load: installment list + master journals.
  useEffect(() => {
    async function init() {
      setLoading(true);
      setLoadError("");
      try {
        const [insts, journals] = await Promise.all([
          listInstallments(),
          listMasterJournals(),
        ]);
        setInstallments(insts);
        setMasterJournals(journals);
      } catch (err) {
        setLoadError(err.message || "Could not load data.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // When an installment is opened, fetch its full row (so we have the
  // current stage + intro_override). The stage components themselves
  // fetch their own per-stage data.
  useEffect(() => {
    let cancelled = false;
    if (!activeInstallmentId) {
      setActiveInstallment(null);
      return;
    }
    async function loadActive() {
      try {
        const inst = await getInstallment(activeInstallmentId);
        if (!cancelled) setActiveInstallment(inst);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load installment.");
      }
    }
    loadActive();
    return () => { cancelled = true; };
  }, [activeInstallmentId]);

  // Called by stage components when they change the installment's
  // current stage (e.g. Stage 1 proceeding to Stage 2). Writes through to
  // the DB and updates both activeInstallment and the dashboard list.
  const setStage = useCallback(async (stage) => {
    if (!activeInstallment) return;
    const updated = await updateInstallment(activeInstallment.id, { stage });
    setActiveInstallment(updated);
    setInstallments(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
  }, [activeInstallment]);

  // Called by Stage 4 when the intro override changes.
  const setIntroOverride = useCallback(async (intro_override) => {
    if (!activeInstallment) return;
    const updated = await updateInstallment(activeInstallment.id, { intro_override });
    setActiveInstallment(updated);
    setInstallments(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
  }, [activeInstallment]);

  // Called by stage components when something happens that should bump the
  // installment's updated_at (e.g. articles got fetched). Writing any field
  // works — we use stage since it's idempotent.
  const touchInstallment = useCallback(async () => {
    if (!activeInstallment) return;
    const updated = await updateInstallment(activeInstallment.id, { stage: activeInstallment.stage });
    setActiveInstallment(updated);
    setInstallments(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
  }, [activeInstallment]);

  // Called by Dashboard after it creates a new installment.
  function handleInstallmentCreated(inst) {
    setInstallments(prev => [inst, ...prev]);
    setActiveInstallmentId(inst.id);
  }

  function handleInstallmentDeleted(id) {
    setInstallments(prev => prev.filter(i => i.id !== id));
    if (activeInstallmentId === id) setActiveInstallmentId(null);
  }

  function closeInstallment() {
    setActiveInstallmentId(null);
  }

  function goToStage(stage) { setStage(stage); }

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

  // Dashboard view (no active installment).
  if (!activeInstallmentId) {
    return (
      <>
        <TopBar user={user} onSignOut={signOut} />
        <Dashboard
          installments={installments}
          setInstallments={setInstallments}
          masterJournals={masterJournals}
          setMasterJournals={setMasterJournals}
          userId={user?.id || null}
          onCreated={handleInstallmentCreated}
          onDeleted={handleInstallmentDeleted}
          onOpen={(id) => setActiveInstallmentId(id)}
        />
      </>
    );
  }

  // Stage view — but we may not have loaded activeInstallment yet.
  if (!activeInstallment) {
    return <FullScreenLoader message="Loading installment…" />;
  }

  const stageProps = {
    installment: activeInstallment,
    setIntroOverride,
    touchInstallment,
    goToStage,
    onBack: closeInstallment,
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bgPage }}>
      <StageNav
        installment={activeInstallment}
        goToStage={goToStage}
        onBack={closeInstallment}
        user={user}
        onSignOut={signOut}
      />
      {activeInstallment.stage === 1 && <Stage1 {...stageProps} />}
      {activeInstallment.stage === 2 && <Stage2 {...stageProps} />}
      {activeInstallment.stage === 3 && <Stage3 {...stageProps} />}
      {activeInstallment.stage === 4 && <Stage4 {...stageProps} />}
      {activeInstallment.stage === 5 && <Stage5 {...stageProps} />}
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

function StageNav({ installment, goToStage, onBack, user, onSignOut }) {
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
      <span style={{ color: COLORS.gold, fontFamily: FONTS.serif, fontSize: 14, marginRight: 8 }}>{installment.name}</span>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {stages.map(({ n, label }) => {
          const done = installment.stage > n;
          const active = installment.stage === n;
          const reachable = n <= installment.stage;
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
