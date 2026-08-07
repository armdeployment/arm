import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneV2Intro } from "./Scenes/Video2/SceneV2Intro";
import { SceneV2OrgTrees } from "./Scenes/Video2/SceneV2OrgTrees";
import { SceneV2OrgEditor } from "./Scenes/Video2/SceneV2OrgEditor";
import { SceneV2Roles } from "./Scenes/Video2/SceneV2Roles";

const FPS = 30;
const T = 12;

/**
 * VIDEO 2 — "One Tool. Every Company Shape."
 * Admin provisions different company structures (manufacturing HQ+plants,
 * holding subsidiaries, finance Chinese walls), then configures who can
 * restructure via capability-based roles.
 * ALL data from real profiles (@arm/profiles) + real dashboard screenshots.
 */
export const ArmVideo2: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Intro">
        <SceneV2Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="OrgTrees">
        <SceneV2OrgTrees />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="OrgEditor">
        <SceneV2OrgEditor />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Roles">
        <SceneV2Roles />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
