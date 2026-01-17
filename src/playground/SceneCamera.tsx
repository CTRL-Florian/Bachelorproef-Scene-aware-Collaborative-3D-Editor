import { useKeyboardControls, OrbitControls } from '@react-three/drei'
import { useRef, useEffect } from 'react'

const SceneCamera: React.FC = () => {
    const controlsRef = useRef<any>(null);
    const [subscribeKeys] = useKeyboardControls();

    const resetCamera = () => {
        if (controlsRef.current) {
            const controls = controlsRef.current;
            const camera = controls.object;

            camera.position.set(10, 10, 10);
            controls.target.set(0, 0, 0);

            controls.update();
        }
    };

    useEffect(() => {
        return subscribeKeys(
            (state) => state.reset,
            (pressed) => {
                if (pressed) {
                    resetCamera();
                }
            }
        );
    }, [subscribeKeys]);

    return (
        <OrbitControls ref={controlsRef}
            makeDefault
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true} 
            enableDamping={false}
            minDistance={2}
            maxDistance={100}
        />
    );
};

export default SceneCamera;