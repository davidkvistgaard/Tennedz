// app/team/layout.js

export default function TeamLayout({ children }) {
  // IMPORTANT:
  // Do NOT wrap TeamShell here, because the pages already use <TeamShell />
  // Wrapping here would duplicate the header/nav.
  return children;
}
