"use client";
import TeamShell from "../../components/TeamShell";
import { useAuth } from "../../components/AuthProvider";
import "../../identity.css";

const formatBalance = new Intl.NumberFormat("en-GB");

export default function EconomyPage() {
  const { session } = useAuth();
  const team = session?.team;

  return <TeamShell title="Economy">
    {team && <section className="club-stats" aria-label="Team balances">
      <div>
        <span>Coins</span>
        <strong>{formatBalance.format(team.coins ?? 0)}</strong>
        <small>Buy riders and pay for team expenses.</small>
      </div>
      <div>
        <span>Gems</span>
        <strong>{formatBalance.format(team.gems ?? 0)}</strong>
        <small>Buy extras for your team.</small>
      </div>
    </section>}
  </TeamShell>;
}
