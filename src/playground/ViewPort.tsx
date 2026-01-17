import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei'

import SceneSettings from '@/playground/SceneSettings';
import SceneAxes from '@/playground/SceneAxes';
import SceneCamera from '@/playground/SceneCamera';
import SceneContent from '@/playground/SceneContent';

const ViewPort: React.FC = () => {
    return (
        <KeyboardControls map={[{ name: 'reset', keys: ['r', 'R']}]}>
            <Canvas>
                <SceneSettings />
                <SceneCamera />
                <SceneAxes />
                <SceneContent />
            </Canvas>
        </KeyboardControls>
    );
};

export default ViewPort;