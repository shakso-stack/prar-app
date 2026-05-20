import { useState } from "react";
import { signInWithEmail } from "../lib/auth";

// Magic-link sign-in screen. Mirrors the visual identity of the rest of
// PRAR App: dark brown background with the hero photograph behind a
// translucent panel. Screen-reader friendly: every field has a label,
// form errors live in an aria-live region, and the submit button shows
// its loading state in text rather than only visually.

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("sending");
    try {
      await signInWithEmail(email.trim());
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Sign-in failed. Please try again.");
    }
  }

  return (
    <div
      role="main"
      style={{
        minHeight: "100vh",
        background: "#1a0f0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Crimson Text, serif",
      }}
    >
      <div
        style={{
          background: "#2c1810",
          border: "1px solid #5a3a28",
          borderRadius: 10,
          padding: "36px 40px",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 6px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 4,
              color: "#d4af7a",
              textTransform: "uppercase",
              marginBottom: 10,
              opacity: 0.85,
            }}
          >
            Periodic Review Tool
          </div>
          <h1
            style={{
              fontSize: 28,
              color: "#fff",
              fontWeight: 400,
              margin: 0,
              letterSpacing: 0.5,
            }}
          >
            Peer-Reviewed Articles Review
          </h1>
          <div style={{ width: 60, height: 2, background: "#d4af7a", margin: "14px auto 0" }} />
        </div>

        {status === "sent" ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: "rgba(212,175,122,0.1)",
              border: "1px solid #d4af7a",
              borderRadius: 6,
              padding: "16px 18px",
              color: "#d4af7a",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>Check your email.</strong>
            We sent a sign-in link to <strong>{email}</strong>. Click the link in
            the email to sign in. The link expires in one hour.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                margin: "0 0 20px",
                lineHeight: 1.5,
              }}
            >
              Enter your email to receive a one-time sign-in link.
            </p>

            <label
              htmlFor="signin-email"
              style={{
                display: "block",
                color: "rgba(212,175,122,0.85)",
                fontSize: 13,
                marginBottom: 6,
                letterSpacing: 0.4,
              }}
            >
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending"}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#1a0f0a",
                border: "1px solid #5a3a28",
                borderRadius: 5,
                color: "#fff",
                fontFamily: "Crimson Text, serif",
                fontSize: 15,
                boxSizing: "border-box",
                marginBottom: 18,
              }}
            />

            {error && (
              <div
                role="alert"
                style={{
                  background: "rgba(255,124,124,0.1)",
                  border: "1px solid rgba(255,124,124,0.4)",
                  borderRadius: 5,
                  padding: "10px 12px",
                  color: "#ff9090",
                  fontSize: 14,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                width: "100%",
                background: "#d4af7a",
                color: "#2c1810",
                border: "none",
                padding: "11px",
                borderRadius: 5,
                fontFamily: "Crimson Text, serif",
                fontSize: 15,
                fontWeight: 600,
                cursor: status === "sending" ? "default" : "pointer",
                opacity: status === "sending" ? 0.7 : 1,
              }}
            >
              {status === "sending" ? "Sending link…" : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
