import { RequireTeam } from "../components/AuthProvider";
export default function TeamLayout({ children }) { return <RequireTeam>{children}</RequireTeam>; }
