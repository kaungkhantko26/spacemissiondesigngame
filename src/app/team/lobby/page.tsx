import { LobbyScreen } from "@/components/screens/Team";
import { LiveLobby } from "@/components/live/Screens";

// Live backend mode when NEXT_PUBLIC_API_URL is set; otherwise the original mock screen.
export default function Page() {
  return process.env.NEXT_PUBLIC_API_URL ? <LiveLobby /> : <LobbyScreen />;
}
