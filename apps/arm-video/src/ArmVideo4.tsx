import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneV4Intro } from "./Scenes/Video4/SceneV4Intro";
import { SceneV4Questionnaire } from "./Scenes/Video4/SceneV4Questionnaire";
import { SceneV4Recommendation } from "./Scenes/Video4/SceneV4Recommendation";
import { SceneV4Setup } from "./Scenes/Video4/SceneV4Setup";
import { SceneV4Refine } from "./Scenes/Video4/SceneV4Refine";
import { SceneV4Outro } from "./Scenes/Video4/SceneV4Outro";

const FPS = 30;
const T = 12;

/**
 * VIDEO 4 — "A Senior Manager's First Install"
 * A simulated employee (the GTM beachhead persona) goes through the real
 * installation wizard end to end: questionnaire → recommendation → arm
 * setup → arm refine. Every screenshot and every terminal line is captured
 * from an actual run against the live apps/onboarding + arm CLI — a real
 * activation code, a real redemption, real detected signals.
 */
export const ArmVideo4: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={5 * FPS} name="Intro">
        <SceneV4Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Questionnaire">
        <SceneV4Questionnaire />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={6 * FPS} name="Recommendation">
        <SceneV4Recommendation />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={9 * FPS} name="Setup">
        <SceneV4Setup />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={9 * FPS} name="Refine">
        <SceneV4Refine />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Outro">
        <SceneV4Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
