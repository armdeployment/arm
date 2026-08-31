import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneV6Intro } from "./Scenes/Video6/SceneV6Intro";
import { SceneV6Questionnaire } from "./Scenes/Video6/SceneV6Questionnaire";
import { SceneV6Recommendation } from "./Scenes/Video6/SceneV6Recommendation";
import { SceneV6Activate } from "./Scenes/Video6/SceneV6Activate";
import { SceneV6Installed } from "./Scenes/Video6/SceneV6Installed";
import { SceneV6Chat } from "./Scenes/Video6/SceneV6Chat";
import { SceneV6MultiFolder } from "./Scenes/Video6/SceneV6MultiFolder";
import { SceneV6Outro } from "./Scenes/Video6/SceneV6Outro";

const FPS = 30;
const T = 12;

/**
 * VIDEO 6 — "One Real Session, End to End"
 * The complete, current installation flow in a single continuous take:
 * questionnaire → recommendation → the no-terminal GUI wizard → connections
 * → a real LLM chat exchange → a real multi-project folder scan. Every
 * screenshot comes from one unscripted run — same activation code, same
 * persona, from start to finish. Supersedes Video 4 (which captured the
 * pre-GUI terminal-based `arm setup`) and folds in Video 5's chat/
 * multi-folder additions as part of the same story, not a separate one.
 */
export const ArmVideo6: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={5 * FPS} name="Intro">
        <SceneV6Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence
        durationInFrames={6 * FPS}
        name="Questionnaire"
      >
        <SceneV6Questionnaire />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence
        durationInFrames={6 * FPS}
        name="Recommendation"
      >
        <SceneV6Recommendation />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Activate">
        <SceneV6Activate />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Installed">
        <SceneV6Installed />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="Chat">
        <SceneV6Chat />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="MultiFolder">
        <SceneV6MultiFolder />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Outro">
        <SceneV6Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
