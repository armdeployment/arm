import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneV1Intro } from "./Scenes/Video1/SceneV1Intro";
import { SceneV1Terminals } from "./Scenes/Video1/SceneV1Terminals";
import { SceneV1Tagging } from "./Scenes/Video1/SceneV1Tagging";
import { SceneV1Dashboard } from "./Scenes/Video1/SceneV1Dashboard";

const FPS = 30;
const T = 12;

/**
 * VIDEO 1 — "Every Prompt, Tagged"
 * Employees work with coding agents → ARM tags every prompt by work-type (D7)
 * → management sees the classification on the dashboard.
 * ALL data from the real running enterprise simulation.
 */
export const ArmVideo1: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Intro">
        <SceneV1Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="Terminals">
        <SceneV1Terminals />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="Tagging">
        <SceneV1Tagging />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="Dashboard">
        <SceneV1Dashboard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
