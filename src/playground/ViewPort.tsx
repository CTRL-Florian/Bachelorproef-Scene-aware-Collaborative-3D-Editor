import { Canvas } from '@react-three/fiber';

import SceneSettings from '@/playground/scene/SceneSettings';
import SceneAxes from '@/playground/scene/SceneAxes';
import SceneCamera from '@/playground/scene/SceneCamera';
import SceneContent from '@/playground/scene/SceneContent';

const ViewPort: React.FC = () => {
    return (
        <Canvas>
            <SceneSettings />
            <SceneCamera />
            <SceneAxes />
            <SceneContent />
        </Canvas>
    );
};

export default ViewPort;