"use client";
import { useState } from "react";
import TeamShell from "../../components/TeamShell";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../../lib/api";

export default function AccountSettings() {
  const { session } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function changePassword(event) {
    event.preventDefault();
    setError(""); setSuccess("");
    if (next !== confirmation) { setError("The new passwords do not match."); return; }
    if (next.length < 12 || next.length > 128) { setError("Choose a new password of 12–128 characters."); return; }
    if (next === current) { setError("Choose a password different from your current one."); return; }
    setBusy(true);
    try {
      await api("/api/auth/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next, confirm_password: confirmation }),
      });
      setCurrent(""); setNext(""); setConfirmation("");
      setSuccess("Password changed. Use your new password the next time you sign in.");
    } catch (cause) {
      setCurrent("");
      setError(cause.message || "Could not change your password. Please try again.");
    } finally { setBusy(false); }
  }

  return <TeamShell title="Account settings">
    <div className="account-settings">
      <section className="studio-panel" aria-labelledby="account-details-title">
        <p className="identity-eyebrow">YOUR ACCOUNT</p>
        <h2 id="account-details-title">Manager profile</h2>
        <p>Signed in as <strong>{session?.user?.display_name || "Manager"}</strong>.</p>
        <p className="account-settings-note">Your team and riders stay connected to this account when you change its password.</p>
      </section>
      <section className="studio-panel" aria-labelledby="password-title">
        <p className="identity-eyebrow">ACCOUNT SECURITY</p>
        <h2 id="password-title">Change password</h2>
        <p>Enter your current password, then choose a new one with at least 12 characters.</p>
        <form onSubmit={changePassword} aria-busy={busy}>
          <label className="studio-field">Current password
            <input type="password" autoComplete="current-password" required maxLength={1024} value={current} onChange={event=>setCurrent(event.target.value)}/>
          </label>
          <label className="studio-field">New password
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={next} onChange={event=>setNext(event.target.value)}/>
          </label>
          <label className="studio-field">Confirm new password
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>
          </label>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Changing password…" : "Change password"}</button>
          {error && <p className="account-settings-error" role="alert">{error}</p>}
          {success && <p className="account-settings-success" role="status">{success}</p>}
        </form>
      </section>
    </div>
  </TeamShell>;
}

