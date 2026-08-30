import { Composition, Folder } from "remotion";
import { ArmVideo } from "./ArmVideo";
import { ArmVideo1 } from "./ArmVideo1";
import { ArmVideo2 } from "./ArmVideo2";
import { ArmVideo3 } from "./ArmVideo3";
import { ArmVideo4 } from "./ArmVideo4";
import { ArmVideo5 } from "./ArmVideo5";
import { ArmVideo6 } from "./ArmVideo6";
import { SceneIntro } from "./Scenes/SceneIntro";
import { SceneProfiles } from "./Scenes/SceneProfiles";
import { SceneWorkType } from "./Scenes/SceneWorkType";
import { SceneNetwork } from "./Scenes/SceneNetwork";
import { SceneWorkstations } from "./Scenes/SceneWorkstations";
import { SceneServer } from "./Scenes/SceneServer";
import { SceneBlocking } from "./Scenes/SceneBlocking";
import { SceneDashboard } from "./Scenes/SceneDashboard";
import { SceneOutro } from "./Scenes/SceneOutro";
import "./index.css";

const FPS = 30;
const W = 1920;
const H = 1080;

// Scene durations (seconds)
const D = {
  intro: 3, profiles: 6, workType: 6, network: 4,
  workstations: 5, server: 4, blocking: 3, dashboard: 4, outro: 4,
};
const T = 12; // transition overlap frames

// ── CORRECT TransitionSeries duration math ────────────────────────────────
// Remotion's TransitionSeries shifts each sequence BACK by the previous
// transition's duration (actualStartFrame = currentStartFrame + transitionOffsets
// − transitionDuration). So the total visible content =
//   sum(sequence durations) − sum(transition durations)
// NOT sum + transitions (that leaves a black tail at the end).
// Verified empirically with a 3-color probe composition.
const totalFrames =
  (D.intro + D.profiles + D.workType + D.network + D.workstations +
   D.server + D.blocking + D.dashboard + D.outro) * FPS -
  8 * T;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Scenes">
        <Composition id="Intro" component={SceneIntro} durationInFrames={D.intro * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Profiles" component={SceneProfiles} durationInFrames={D.profiles * FPS} fps={FPS} width={W} height={H} />
        <Composition id="WorkType" component={SceneWorkType} durationInFrames={D.workType * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Network" component={SceneNetwork} durationInFrames={D.network * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Workstations" component={SceneWorkstations} durationInFrames={D.workstations * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Server" component={SceneServer} durationInFrames={D.server * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Blocking" component={SceneBlocking} durationInFrames={D.blocking * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Dashboard" component={SceneDashboard} durationInFrames={D.dashboard * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Outro" component={SceneOutro} durationInFrames={D.outro * FPS} fps={FPS} width={W} height={H} />
      </Folder>
      <Composition
        id="ArmVideo"
        component={ArmVideo}
        durationInFrames={totalFrames}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="ArmVideo1-Tagged"
        component={ArmVideo1}
        durationInFrames={(4 + 8 + 8 + 8) * FPS - 3 * T}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="ArmVideo2-Structures"
        component={ArmVideo2}
        durationInFrames={(4 + 8 + 7 + 7) * FPS - 3 * T}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="ArmVideo3-DbWiring"
        component={ArmVideo3}
        durationInFrames={(4 + 6 + 7 + 7 + 8) * FPS - 4 * T}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="ArmVideo4-InstallWizard"
        component={ArmVideo4}
        durationInFrames={(5 + 7 + 6 + 9 + 9 + 7) * FPS - 5 * T}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="ArmVideo5-ChatAndFolders"
        component={ArmVideo5}
        durationInFrames={(5 + 6 + 8 + 8 + 7) * FPS - 4 * T}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="ArmVideo6-EndToEnd"
        component={ArmVideo6}
        durationInFrames={(5 + 6 + 6 + 7 + 7 + 8 + 8 + 7) * FPS - 7 * T}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
