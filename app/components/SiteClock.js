"use client";
import { useEffect, useState } from "react";

const format = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
});

export default function SiteClock() {
  const [now, setNow] = useState(null);
  const [offset, setOffset] = useState(0);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let active = true;
    setNow(Date.now());
    async function sync() {
      const sent = Date.now();
      try {
        const response = await fetch("/api/time", { cache: "no-store" });
        if (!response.ok) throw new Error("Clock unavailable");
        const data = await response.json();
        const received = Date.now();
        const serverTime = Date.parse(data.server_time);
        if (!Number.isFinite(serverTime)) throw new Error("Invalid server time");
        if (active) {
          setOffset(serverTime - (sent + received) / 2);
          setNow(received);
          setSynced(true);
        }
      } catch {
        if (active) setSynced(false);
      }
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const resync = setInterval(sync, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    sync();
    return () => {
      active = false;
      clearInterval(tick);
      clearInterval(resync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const instant = now === null ? null : new Date(now + (synced ? offset : 0));
  return <div className="site-clock" aria-label="Current local date and time" data-testid="site-clock">
    <span className="site-clock-label">Live time</span>
    {instant ? <time dateTime={instant.toISOString()}>{format.format(instant)}</time> : <span>Loading time…</span>}
    <span className="site-clock-source">{synced ? "Server synced · local time zone" : "Device time · syncing"}</span>
  </div>;
}
