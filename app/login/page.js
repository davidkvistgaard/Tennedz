"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data?.session) {
        window.location.href = "/team";
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("Logger ind...");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setStatus("Logget ind ✅");
      window.location.href = "/team";
    } catch (err) {
      setStatus("Fejl: " + (err?.message ?? String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f6f4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 18,
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a" }}>
            PELOTONIA
          </div>
          <div style={{ fontSize: 15, color: "rgba(15,23,42,0.72)" }}>
            Cycling Manager
          </div>
        </div>

        <h1
          style={{
            fontSize: 30,
            lineHeight: 1.1,
            margin: "0 0 8px 0",
            color: "#0f172a",
          }}
        >
          Log ind
        </h1>

        <p style={{ margin: "0 0 20px 0", color: "rgba(15,23,42,0.72)" }}>
          Log ind for at se dit hold, dine ryttere og dine løb.
        </p>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 14 }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.com"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.14)",
                fontSize: 16,
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Kodeord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.14)",
                fontSize: 16,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              padding: "12px 16px",
              borderRadius: 999,
              border: "1px solid rgba(14,143,70,0.4)",
              background: busy
                ? "rgba(31,175,90,0.75)"
                : "linear-gradient(180deg,#1FAF5A 0%, #0E8F46 100%)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Logger ind..." : "Log ind"}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            minHeight: 22,
            color: status.startsWith("Fejl") ? "#b91c1c" : "rgba(15,23,42,0.72)",
            fontSize: 14,
          }}
        >
          {status}
        </div>

        <div style={{ marginTop: 18 }}>
          <a
            href="/"
            style={{
              color: "#0E8F46",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← Tilbage til forsiden
          </a>
        </div>
      </div>
    </main>
  );
}
