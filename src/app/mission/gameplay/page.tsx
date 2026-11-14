import { GameplayScreen } from "@/components/screens/Mission";
import { LiveDesign } from "@/components/live/Screens";

// Live backend mode when NEXT_PUBLIC_API_URL is set; otherwise the original mock screen.
export default function Page() {
  return process.env.NEXT_PUBLIC_API_URL ? <LiveDesign /> : <GameplayScreen />;
}
