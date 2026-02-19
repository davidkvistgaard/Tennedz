"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Loading from "./Loading";
import SmallButton from "./SmallButton";

function NavItem({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        border: "1px solid #eee",
        background: active ? "#111" : "white",
        color: active ? "white" : "black"
      }}
    >
      {label}
    </Link>
  );
}

async function maybeExchangeCodeForSession() {
  if (typeof window === "undefined") return { didExchange: false };

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return { didExchange: false };

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { didExchange: true, error };

  url.searchParams.delete("code");
  window.history.replaceState({}, document.title, url.toString());
  return { didExchange: true, error: null };
}

export default function TeamShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [bootError, setBootError] = useState("");

  const isTeamHome = pathname === "/team";

  useEffect(() => {
    let alive = true;

    async function boot() {
      setBootError("");
      setBooting(true);

      // Handle magic-link code on ANY /team/* page
      const ex = await maybeExchangeCodeForSession();
      if (!alive) return;

      if (ex?.error) {
        setBootError("Login-fejl: " + ex.error.message);
      }

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error) {
        setBootError("Session-fejl: " + error.message);
        setSession(null);
        setBooting(false);
        return;
      }

      setSession(data?.session || null);
      setBooting(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data?.session || null);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    router.push("/team");
  }

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Tennedz</div>
          <div style={{ opacity: 0.75 }}>Manager spil · prototype</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {session ? (
            <>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Logget ind ✅</div>
              <SmallButton onClick={signOut}>Log ud</SmallButton>
            </>
          ) : (
            <div style={{ opacity: 0.75, fontSize: 13 }}>Ikke logget ind</div>
          )}
        </div>
      </div>

      {booting ? (
        <div style={{ marginTop: 14 }}>
          <Loading text="Forbereder login/session…" />
        </div>
      ) : bootError ? (
        <div style={{ marginTop: 14, color: "crimson" }}>{bootError}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, marginTop: 16 }}>
          <aside style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <NavItem href="/team" label="Mit hold" />
            <NavItem href="/team/run" label="Kør løb" />
            <NavItem href="/team/presets" label="Taktik-presets" />
            <NavItem href="/team/leaderboards" label="Ranglister" />
            <NavItem href="/team/history" label="Tidligere løb" />

            <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
              (Træning, transfer, lobby/custom races kommer senere)
            </div>
          </aside>

          <section style={{ minWidth: 0 }}>
            {/* IMPORTANT: Allow /team to render even when logged out (so login form shows). */}
            {!session && !isTeamHome ? (
              <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Du er ikke logget ind</div>
                <div style={{ marginTop: 8, opacity: 0.8 }}>
                  Gå til <Link href="/team">Mit hold</Link> og log ind.
                </div>
              </div>
            ) : (
              children
            )}
          </section>
        </div>
      )}
    </div>
  );
}
