import Link from "next/link";
import Image from "next/image";
import "./identity.css";
function Portrait({ column, row, className }) {
  return <div className={`identity-portrait ${className}`} aria-hidden="true"><div style={{ width: "320%", height: "454.44%", left: `${-[21,350,682][column]/3.2}%`, top: `${-[60,408,756,1104][row]/3.38}%` }}><Image src="/images/portrait-study-04.png" alt="" fill sizes="1024px" priority /></div></div>;
}
export default function Home() {
  return <div className="identity-home">
    <header className="identity-nav"><Link href="/" className="identity-logo">pelotonia<span>CYCLING MANAGER</span></Link><nav aria-label="Navigation"><Link href="/login">Log ind</Link><Link className="btn primary" href="/signup">Skab dit hold ↗</Link></nav></header>
    <section className="identity-hero">
      <div className="identity-copy"><p className="identity-eyebrow">STORE PERSONLIGHEDER. STORE CYKELLØB.</p><h1>Et hold at<br/>tro på.<br/><em>Et løb at leve for.</em></h1><p className="identity-lead">De har benene. Du har planen. Saml dit hold, læs ruten, og send de rigtige otte ryttere afsted.</p><Link className="btn primary identity-cta" href="/signup">Din historie starter her ↗</Link><p className="identity-note">16 ryttere fra start · Mænd og kvinder i separate løb</p></div>
      <div className="identity-cast"><span className="identity-stamp">DIT HOLD.<br/>DINE AMBITIONER.</span><Portrait column={2} row={3} className="portrait-one"/><Portrait column={1} row={0} className="portrait-two"/><Portrait column={0} row={2} className="portrait-three"/><p>Portrætstudie · spillets visuelle retning</p></div>
    </section>
    <section className="identity-landscape"><Image src="/images/race-countryside-v1.png" alt="En snoet landevej mellem grønne bakker og bjerge" fill sizes="100vw"/><div><p className="identity-eyebrow">FRA HOLDKONTORET TIL MÅLSTREGEN</p><h2>Det begynder med en plan.<br/>Det ender på landevejen.</h2></div></section>
    <section className="identity-steps" aria-label="Sådan spiller du">{[
      ["01", "Lær dit hold at kende", "Sprintere, klatrere og stærke hjælpere. Find rytternes styrker, og byg din egen fortælling."],
      ["02", "Læg planen før deadline", "Vælg otte ryttere og en kaptajn til ruten. Dine beslutninger er låst, når fristen udløber."],
      ["03", "Følg løbets fortælling", "Løbet beregnes inden visningen. Følg udfaldet i replay, og se, hvad din plan førte til."],
    ].map(([n,title,copy])=><article key={n}><span>{n}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
    <footer className="identity-footer"><strong>pelotonia</strong><p>Et cykelmanagerspil under udvikling. Portrætterne ovenfor viser den ønskede billedstil; holdets nuværende portrætter er tegnede.</p><Link href="/signup">Byg dit første hold ↗</Link></footer>
  </div>;
}
