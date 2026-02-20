import "./globals.css";

export const metadata = {
  title: "Tennedz",
  description: "Cycling manager game"
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
