export const metadata = {
  title: "Tennedz",
  description: "Online cycling manager"
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
