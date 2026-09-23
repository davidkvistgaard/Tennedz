import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";

export const metadata = {
  title: "Pelotonia – Cycling Manager",
  description: "Pelotonia – Cycling Manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>
        <AuthProvider><main>{children}</main></AuthProvider>
      </body>
    </html>
  );
}
