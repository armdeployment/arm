import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { SceneV5Intro } from "./Scenes/Video5/SceneV5Intro";
import { SceneV5Routing } from "./Scenes/Video5/SceneV5Routing";
import { SceneV5Chat } from "./Scenes/Video5/SceneV5Chat";
import { SceneV5MultiFolder } from "./Scenes/Video5/SceneV5MultiFolder";
import { SceneV5Outro } from "./Scenes/Video5/SceneV5Outro";

const FPS = 30;
const T = 12;

/**
 * VIDEO 5 — "The Wizard Talks Back"
 * Two upgrades to the install wizard from Video 4: an LLM chat assistant
 * routed through the tenant's own data-plane proxy (never third-party,
 * never ARM's control plane), and a multi-project folder picker. Every
 * screenshot is a live capture — a real activation code, a real reply from
 * a real Ollama model, a real scan across two real seeded folders.
 */
export const ArmVideo5: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={5 * FPS} name="Intro">
        <SceneV5Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={6 * FPS} name="Routing">
        <SceneV5Routing />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="Chat">
        <SceneV5Chat />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={8 * FPS} name="MultiFolder">
        <SceneV5MultiFolder />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: T })}
      />
      <TransitionSeries.Sequence durationInFrames={7 * FPS} name="Outro">
        <SceneV5Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
