import { create } from "zustand";
import { GameClient, GameError, LIVE_ENABLED, ensureToken, getCatalog } from "./client";
import type { Catalog, DesignPatch, Difficulty, Profile, Room, StatId } from "./types";

type Conn = "idle" | "connecting" | "online" | "offline";
interface GameState {
  conn: Conn; ready: boolean; error: string | null;
  catalog: Catalog | null; profile: Profile | null; room: Room | null;
  roomAt: number; // local time the last room view arrived (for the countdown)
  boot: () => Promise<void>;
  createRoom: () => Promise<void>; joinRoom: (code: string) => Promise<void>; leaveRoom: () => Promise<void>;
  setup: (missionId: string, difficulty: Difficulty) => Promise<void>;
  startRoles: () => Promise<void>; claim: (slot: string, characterId: string) => Promise<void>; release: () => Promise<void>;
  startDesign: () => Promise<void>; setDesign: (patch: DesignPatch) => Promise<void>; approve: (v: boolean) => Promise<void>;
  launch: () => Promise<void>; opsSet: (patch: { duty?: number; downlink?: "normal" | "boost"; mode?: "nominal" | "safe" }) => Promise<void>; opsRespond: (option: string) => Promise<void>; opsRepair: () => Promise<void>; devAutodesign: () => Promise<void>; devAddBot: () => Promise<void>; devRemoveBot: () => Promise<void>; redesign: () => Promise<void>; toLobby: () => Promise<void>; chat: (text: string) => Promise<void>;
  upgrade: (stat: StatId) => Promise<void>; rename: (name: string) => Promise<void>; equip: (item: string) => Promise<void>;
}

let client: GameClient | null = null;
let booting = false;

export const useGame = create<GameState>((set) => {
  const run = async (fn: () => Promise<void>) => {
    try { await fn(); set({ error: null }); }
    catch (e) { set({ error: e instanceof GameError ? e.message : "Something went wrong" }); throw e; }
  };
  const send = (m: Parameters<GameClient["send"]>[0]) => run(() => {
    if (!client) throw new GameError("offline", "Not connected");
    return client.send(m);
  });
  return {
    conn: "idle", ready: false, error: null, catalog: null, profile: null, room: null, roomAt: 0,
    async boot() {
      if (booting || client || !LIVE_ENABLED) return;
      booting = true;
      try {
        const [catalog, token] = await Promise.all([getCatalog(), ensureToken()]);
        set({ catalog });
        client = new GameClient(token, {
          hello: (profile, room) => set({ profile, room, roomAt: Date.now(), ready: true }),
          room: (room) => set({ room, roomAt: Date.now() }),
          profile: (profile) => set({ profile }),
          status: (conn) => set({ conn }),
        });
        client.connect();
      } catch {
        set({ error: "Can't reach the game server", conn: "offline" });
      } finally { booting = false; }
    },
    createRoom: () => send({ t: "room.create" }),
    joinRoom: (code) => send({ t: "room.join", code: code.trim().toUpperCase() }),
    leaveRoom: () => send({ t: "room.leave" }),
    setup: (missionId, difficulty) => send({ t: "room.setup", missionId, difficulty }),
    startRoles: () => send({ t: "room.start_roles" }),
    claim: (slot, characterId) => send({ t: "role.claim", slot, characterId }),
    release: () => send({ t: "role.release" }),
    startDesign: () => send({ t: "room.start_design" }),
    setDesign: (patch) => send({ t: "design.set", patch }),
    approve: (approved) => send({ t: "design.approve", approved }),
    launch: () => send({ t: "launch" }),
    opsSet: (patch) => send({ t: "ops.set", patch }),
    opsRespond: (option) => send({ t: "ops.respond", option }),
    opsRepair: () => send({ t: "ops.repair" }),
    devAutodesign: () => send({ t: "dev.autodesign" }),
    devAddBot: () => send({ t: "dev.addbot" }),
    devRemoveBot: () => send({ t: "dev.removebot" }),
    redesign: () => send({ t: "room.redesign" }),
    toLobby: () => send({ t: "room.to_lobby" }),
    chat: (text) => send({ t: "chat", text }),
    upgrade: (stat) => send({ t: "profile.upgrade", stat }),
    rename: (name) => send({ t: "profile.rename", name }),
    equip: (item) => send({ t: "cosmetic.equip", item }),
  };
});
