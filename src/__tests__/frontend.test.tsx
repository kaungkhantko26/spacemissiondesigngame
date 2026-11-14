import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { missionAvailability, roleCounts } from "@/lib/mission";
import { missions } from "@/data/mock";
import { useCrewSelectionStore, useMissionSetupStore, useUIStore } from "@/stores";
import { ErrorState, LoadingBar, GameButton } from "@/components/ui";
import { lobbyService } from "@/services/mocks";

const m = (id: string) => missions.find((x) => x.id === id)!;

describe("mission availability filtering (presentation only)", () => {
  it("disables hard-only missions on easy with a reason", () => {
    const a = missionAvailability(m("space-telescope"), "easy", 4);
    expect(a.available).toBe(false);
    expect(a.reason).toBeTruthy();
  });
  it("keeps unfinished missions visible but unavailable", () => {
    expect(missionAvailability(m("deep-space-probe"), "hard", 4).available).toBe(false);
  });
  it("explains player-count restrictions", () => {
    expect(missionAvailability(m("mars-recon"), "medium", 1).reason).toMatch(/at least 2/);
  });
  it("allows a compatible mission", () => {
    expect(missionAvailability(m("lunar-landing"), "easy", 1).available).toBe(true);
  });
});

describe("difficulty selection", () => {
  beforeEach(() => useMissionSetupStore.getState().reset());
  it("clears the mission when difficulty changes", () => {
    useMissionSetupStore.getState().setMission("lunar-landing");
    useMissionSetupStore.getState().setDifficulty("hard");
    expect(useMissionSetupStore.getState().missionId).toBeNull();
  });
});

describe("role + character selection state", () => {
  beforeEach(() => useCrewSelectionStore.getState().reset());
  it("tracks role counts and resets character on role change", () => {
    const s = useCrewSelectionStore.getState();
    s.ensure(["p1", "p2"]);
    s.chooseRole("p1", "specialist");
    s.chooseCharacter("p1", "c-reyes");
    s.chooseRole("p1", "engineer");
    const a = useCrewSelectionStore.getState().assignments;
    expect(a.p1.characterId).toBeNull();
    expect(roleCounts(Object.values(a)).engineer).toBe(1);
  });
  it("confirm flags are set", () => {
    const s = useCrewSelectionStore.getState();
    s.ensure(["p1"]); s.chooseRole("p1", "leader"); s.confirmRole("p1"); s.chooseCharacter("p1", "c-tanaka"); s.confirmCharacter("p1");
    expect(useCrewSelectionStore.getState().assignments.p1.confirmedCharacter).toBe(true);
  });
});

describe("mock lobby simulation", () => {
  it("supports join, ready, leave", async () => {
    let last: { members: unknown[] } | null = null;
    const off = lobbyService.subscribe((l) => (last = l));
    await lobbyService.create("Test");
    lobbyService.simulate.join();
    expect(last!.members).toHaveLength(2);
    lobbyService.simulate.leave();
    expect(last!.members).toHaveLength(1);
    off();
  });
});

describe("feedback components", () => {
  it("renders error state with retry", () => {
    const retry = vi.fn();
    render(<ErrorState message="boom" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    screen.getByText("Try again").click();
    expect(retry).toHaveBeenCalled();
  });
  it("indeterminate loading bar has no value; loading button is disabled", () => {
    render(<><LoadingBar /><GameButton loading>Go</GameButton></>);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("toasts are added to UI store", () => {
    useUIStore.getState().toast("hi");
    expect(useUIStore.getState().toasts.length).toBeGreaterThan(0);
  });
});
