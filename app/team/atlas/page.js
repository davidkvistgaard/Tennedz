import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import "./atlas.css";

const atlasUrl = "/pelotonia-atlas/index.html";

export const metadata = { title: "Pelotonia Atlas" };

export default function AtlasPage() {
  return (
    <TeamShell compact>
      <header className="atlas-heading">
        <div>
          <p className="atlas-eyebrow">A WORLD TO DISCOVER</p>
          <h1>Pelotonia Atlas</h1>
          <p>Explore the island in 3D and follow drone flights through all 192 fields.</p>
        </div>
        <nav className="atlas-view-links" aria-label="Atlas views">
          <Link className="btn" href="/team/atlas/directory">Place directory</Link>
          <a className="btn" href={atlasUrl}>Open full-screen atlas</a>
        </nav>
      </header>
      <iframe className="atlas-scene" src={atlasUrl} title="Interactive 3D atlas of Pelotonia" />
    </TeamShell>
  );
}
