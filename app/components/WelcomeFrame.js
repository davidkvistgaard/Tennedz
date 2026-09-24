import Link from "next/link";
import Image from "next/image";
export default function WelcomeFrame({ eyebrow, title, intro, children }) {
  return <div className="welcome experience-welcome">
    <aside className="welcome-story">
      <Link href="/" className="welcome-brand">pelotonia<span>CYCLING MANAGER</span></Link>
      <div className="welcome-story-copy"><p className="welcome-eyebrow">YOUR TEAM. YOUR STORY.</p><h2>Big personalities.<br/><em>Bigger ambitions.</em></h2><p>Find your eight. Back your captain. See where the road takes you.</p></div>
      <div className="welcome-art" aria-hidden="true">
        <Image src="/images/race-countryside-v1.png" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" priority />
        <div className="welcome-art-portrait"><div><Image src="/images/portrait-study-04.png" alt="" fill sizes="1024px" priority /></div></div>
        <span className="welcome-art-note">THE ROAD IS WAITING.</span>
      </div>
      <p className="welcome-story-foot">One team. Two squads. A world of racing.</p>
    </aside>
    <section className="welcome-form" aria-labelledby="welcome-title"><div className="welcome-card"><p className="welcome-eyebrow">{eyebrow}</p><h1 id="welcome-title">{title}</h1><p className="welcome-intro">{intro}</p>{children}</div></section>
  </div>;
}
