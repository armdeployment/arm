import { Composition, Folder } from "remotion";
import { ArmVideo } from "./ArmVideo";
import { SceneIntro } from "./Scenes/SceneIntro";
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

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Scenes">
        <Composition id="Intro" component={SceneIntro} durationInFrames={3 * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Network" component={SceneNetwork} durationInFrames={4 * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Workstations" component={SceneWorkstations} durationInFrames={5 * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Server" component={SceneServer} durationInFrames={4 * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Blocking" component={SceneBlocking} durationInFrames={3 * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Dashboard" component={SceneDashboard} durationInFrames={4 * FPS} fps={FPS} width={W} height={H} />
        <Composition id="Outro" component={SceneOutro} durationInFrames={4 * FPS} fps={FPS} width={W} height={H} />
      </Folder>
      <Composition
        id="ArmVideo"
        component={ArmVideo}
        durationInFrames={3 * FPS + 12 + 4 * FPS + 12 + 5 * FPS + 12 + 4 * FPS + 12 + 3 * FPS + 12 + 4 * FPS + 12 + 4 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
