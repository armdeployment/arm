import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneV3Intro } from "./Scenes/Video3/SceneV3Intro";
import { SceneV3Architecture } from "./Scenes/Video3/SceneV3Architecture";
import { SceneV3Adoption } from "./Scenes/Video3/SceneV3Adoption";
import { SceneV3Library } from "./Scenes/Video3/SceneV3Library";
import { SceneV3Outro } from "./Scenes/Video3/SceneV3Outro";

const FPS = 30;
const T = 12;

/**
 * VIDEO 3 — "From Fixtures to Real Data" (Wave 3 DB wiring)
 * adoption-router.ts (ClickHouse), catalog-router.ts + library-router.ts
 * (Postgres) — same UI, same tRPC contract, real databases underneath.
 * ALL data + screenshots captured from the live dashboard running with
 * ARM_FIXTURE_MODE=0 against real Postgres/ClickHouse containers.
 */
export const ArmVideo3: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Intro">
        <SceneV3Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={6 * FPS} name="Architecture">
        <SceneV3Architecture />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Adoption">
        <SceneV3Adoption />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Library">
        <SceneV3Library />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="Outro">
        <SceneV3Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
