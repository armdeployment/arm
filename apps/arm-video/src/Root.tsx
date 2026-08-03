import { Composition, Folder } from "remotion";
import { ArmVideo } from "./ArmVideo";
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

// Total = sum of all sequences + transitions (transitions overlap, adding T each)
const totalFrames =
  D.intro * FPS + T +
  D.profiles * FPS + T +
  D.workType * FPS + T +
  D.network * FPS + T +
  D.workstations * FPS + T +
  D.server * FPS + T +
  D.blocking * FPS + T +
  D.dashboard * FPS + T +
  D.outro * FPS;

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
    </>
  );
};
