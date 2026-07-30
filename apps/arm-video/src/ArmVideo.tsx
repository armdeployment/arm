import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneIntro } from "./Scenes/SceneIntro";
import { SceneNetwork } from "./Scenes/SceneNetwork";
import { SceneWorkstations } from "./Scenes/SceneWorkstations";
import { SceneServer } from "./Scenes/SceneServer";
import { SceneBlocking } from "./Scenes/SceneBlocking";
import { SceneDashboard } from "./Scenes/SceneDashboard";
import { SceneOutro } from "./Scenes/SceneOutro";

const FPS = 30;
const T = 12;

export const ArmVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={3 * FPS} name="Intro">
        <SceneIntro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Network">
        <SceneNetwork />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={5 * FPS} name="Workstations">
        <SceneWorkstations />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Server">
        <SceneServer />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={3 * FPS} name="DLP Blocking">
        <SceneBlocking />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Dashboard">
        <SceneDashboard />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={4 * FPS} name="Outro">
        <SceneOutro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
