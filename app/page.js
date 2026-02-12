"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Ikke logget ind");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data?.session ? "Logget ind ✅" : "Ikke logget ind");
    });
  }, []);

  async function signInWithEmail(e) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setStatus("Fejl: " + error.message);
    else setStatus("Tjek din email for login-link ✉️");
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Tennedz</h1>
      <p>Status: {status}</p>

      <form onSubmit={signInWithEmail} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="din@email.dk"
          style={{ padding: 8, width: 260 }}
        />
        <button type="submit" style={{ padding: "8px 12px" }}>Login</button>
      </form>
    </main>
  );
}
