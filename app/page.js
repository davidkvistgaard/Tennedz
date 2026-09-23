import Link from "next/link";
import WelcomeFrame from "./components/WelcomeFrame";
export default function Home() {
  return <WelcomeFrame eyebrow="CYKLING. TAKTIK. AMBITIONER." title="Dit næste løb starter med dig" intro="Byg en trup med personlighed. Vælg otte ryttere og en kaptajn, der passer til ruten, og jagt point i feltet.">
    <div className="starter-summary"><div><strong>16</strong><span>ryttere fra start</span></div><div><strong>2</strong><span>løbskategorier</span></div><div><strong>Dit</strong><span>hold · dine valg</span></div></div>
    <div className="welcome-fields"><Link className="btn primary" href="/signup">Opret dit hold →</Link><Link className="btn" href="/login">Log ind</Link></div>
    <p className="welcome-footer">Pelotonia er under udvikling. Vi bygger videre mod en levende løbskalender og etapeløb med samlet klassement.</p>
  </WelcomeFrame>;
}
