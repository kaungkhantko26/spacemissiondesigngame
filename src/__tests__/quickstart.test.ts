import { describe, expect, it } from "vitest";
import { evaluate } from "@/game/engine";
import { useDesignStore } from "@/game/store";

describe("quick start", () => {
  for (const id of ["moon", "mars"]) {
    it(`builds a go-for-launch ${id} design`, () => {
      expect(useDesignStore.getState().quickStart(id)).toBe(true);
      const d = useDesignStore.getState().design;
      expect(d.destinationId).toBe(id);
      expect(evaluate(d).goNoGo).toBe(true);
    });
  }
});
