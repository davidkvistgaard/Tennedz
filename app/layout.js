import "./globals.css";

export const metadata = {
  title: "Pelotonia – Cycling Manager",
  description: "Pelotonia – Cycling Manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
