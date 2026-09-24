import "./globals.css";
import "./experience.css";
import "./studio.css";
import { ClubStyleProvider } from "./components/ClubStyle";
import { AuthProvider } from "./components/AuthProvider";

export const metadata = {
  title: "Pelotonia – Cycling Manager",
  description: "Pelotonia – Cycling Manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider><ClubStyleProvider><main>{children}</main></ClubStyleProvider></AuthProvider>
      </body>
    </html>
  );
}
