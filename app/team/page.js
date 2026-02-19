"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateTeam } from "../../lib/team";
import Loading from "../components/Loading";
import SmallButton from "../components/SmallButton";

function normalizeUsername(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

// Hidden internal email mapping
function usernameToEmail(username) {
  const u = normalizeUsername(username);
  return `${u}@tennedz.local`;
}

async function maybeExchangeCodeForSession() {
  // keep compatibility if old email OTP links still exist
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

export default function TeamHome() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Tjekker login…");
  const [session, setSession] = useState(null);

  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);

  async function loadRiders(teamId) {
    const { data, error } = await supabase
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", teamId);
    if (error) throw error;
    setRiders((data ?? []).map((x) => x.rider).filter(Boolean));
  }

  async function refresh() {
    setStatus("Tjekker login…");

    const ex = await maybeExchangeCodeForSession();
    if (ex?.error) {
      setStatus("Login-fejl: " + ex.error.message);
      setSession(null);
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus("Fejl: " + error.message);
      setSession(null);
      return;
    }

    const s = data?.session || null;
    setSession(s);
    setStatus(s ? "Logget ind ✅" : "Ikke logget ind");

    if (!s) {
      setTeam(null);
      setRiders([]);
      return;
    }

    try {
      const res = await getOrCreateTeam();
      setTeam(res.team || null);
      if (res.team?.id) await loadRiders(res.team.id);
    } catch (e) {
      setStatus("Fejl ved init: " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signUp(e) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!u) return setStatus("Skriv et brugernavn.");
    if (!password || password.length < 6) return setStatus("Kodeord skal være mindst 6 tegn.");

    setBusy(true);
    setStatus("Opretter konto…");
    try {
      const email = usernameToEmail(u);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: u }
        }
      });

      if (error) throw error;

      setStatus("Konto oprettet ✅ Du kan nu logge ind.");
    } catch (e2) {
      setStatus("Fejl: " + (e2?.message ?? String(e2)));
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!u) return setStatus("Skriv et brugernavn.");
    if (!password) return setStatus("Skriv et kodeord.");

    setBusy(true);
    setStatus("Logger ind…");
    try {
      const email = usernameToEmail(u);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      setStatus("Logget ind ✅");
    } catch (e2) {
      setStatus("Fejl: " + (e2?.message ?? String(e2)));
    } finally {
