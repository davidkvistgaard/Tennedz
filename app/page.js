import Link from "next/link";
import Image from "next/image";
import "./identity.css";
function Portrait({ column, row, className }) {
  return <div className={`identity-portrait ${className}`} aria-hidden="true"><div style={{ width: "320%", height: "454.44%", left: `${-[21,350,682][column]/3.2}%`, top: `${-[60,408,756,1104][row]/3.38}%` }}><Image src="/images/portrait-study-04.png" alt="" fill sizes="1024px" priority /></div></div>;
}
export default function Home() {
  return <div className="identity-home">
    <header className="identity-nav"><Link href="/" className="identity-logo">pelotonia<span>CYCLING MANAGER</span></Link><nav aria-label="Navigation"><Link href="/login">Sign in</Link><Link className="btn primary" href="/signup">Create your team ↗</Link></nav></header>
    <section className="identity-hero">
      <div className="identity-copy"><p className="identity-eyebrow">BIG PERSONALITIES. BIG RACES.</p><h1>A team to<br/>believe in.<br/><em>A race to live for.</em></h1><p className="identity-lead">They have the legs. You have the plan. Build your team, read the route, and send the right eight riders to the start.</p><Link className="btn primary identity-cta" href="/signup">Your story starts here ↗</Link><p className="identity-note">Start with 16 riders · Separate races for men and women</p></div>
      <div className="identity-cast"><span className="identity-stamp">YOUR TEAM.<br/>YOUR AMBITIONS.</span><Portrait column={2} row={3} className="portrait-one"/><Portrait column={1} row={0} className="portrait-two"/><Portrait column={0} row={2} className="portrait-three"/><p>Portrait study · our visual direction</p></div>
    </section>
    <section className="identity-landscape"><Image src="/images/race-countryside-v1.png" alt="A winding road through green hills and mountains" fill sizes="100vw"/><div><p className="identity-eyebrow">FROM THE TEAM OFFICE TO THE FINISH LINE</p><h2>It starts with a plan.<br/>It unfolds on the road.</h2></div></section>
    <section className="identity-steps" aria-label="How to play">{[
      ["01", "Get to know your team", "Sprinters, climbers, and dedicated domestiques. Discover their strengths and build your own story."],
      ["02", "Make your plan before the deadline", "Choose eight riders and a captain for the route. Your decisions are locked when the deadline passes."],
      ["03", "Watch the race unfold", "The race is calculated before playback. Watch the replay and discover how your plan played out."],
    ].map(([n,title,copy])=><article key={n}><span>{n}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
    <footer className="identity-footer"><strong>pelotonia</strong><p>A cycling manager game in development. These portraits show our intended art style; team portraits currently use illustrated avatars.</p><Link href="/signup">Build your first team ↗</Link></footer>
  </div>;
}
