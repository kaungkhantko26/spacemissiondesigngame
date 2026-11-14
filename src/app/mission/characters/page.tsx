import { CharactersScreen } from "@/components/screens/Mission";
import { LiveCharacters } from "@/components/live/Screens";

// Live backend mode when NEXT_PUBLIC_API_URL is set; otherwise the original mock screen.
export default function Page() {
  return process.env.NEXT_PUBLIC_API_URL ? <LiveCharacters /> : <CharactersScreen />;
}
