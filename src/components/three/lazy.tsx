"use client";
import dynamic from "next/dynamic";
import { SkeletonLoader } from "@/components/ui";

/**
 * Only the canvas wrapper is loaded client-side (ssr: false). Scene children must be
 * plain components: next/dynamic wrappers don't render inside the R3F reconciler.
 */
export const Scene3D = dynamic(() => import("./index").then((m) => m.Scene3D), {
  ssr: false,
  loading: () => <SkeletonLoader className="h-full w-full min-h-48" />,
});
export {
  Astronaut, CrewLineup, PlanetModel, MissionHangar, OrbitalVisualization, SpacecraftPreview,
} from "./index";
