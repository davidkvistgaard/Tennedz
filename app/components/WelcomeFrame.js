import Link from "next/link";
export default function WelcomeFrame({ eyebrow, title, intro, children }) {
  return <div className="welcome">
    <aside className="welcome-story">
      <Link href="/" className="welcome-brand">PELOTONIA<span>CYCLING MANAGER</span></Link>
      <div><p className="welcome-eyebrow">YOUR TEAM. YOUR STORY.</p><h1>Great victories<br/>start here.</h1>
        <p>Build your team, get to know your riders, and find the right captain for your next race.</p></div>
      <div className="welcome-profile" aria-hidden="true"><svg viewBox="0 0 480 140" fill="none"><path d="M0 120L70 108L122 62L170 92L238 20L295 81L338 58L400 112L480 92" stroke="currentColor" strokeWidth="3"/><path d="M0 138H480" stroke="currentColor" opacity=".3"/></svg><span>ONE TEAM · TWO RACE CATEGORIES</span></div>
    </aside>
    <section className="welcome-form"><div className="welcome-card"><p className="welcome-eyebrow">{eyebrow}</p><h2>{title}</h2><p className="welcome-intro">{intro}</p>{children}</div></section>
  </div>;
}
