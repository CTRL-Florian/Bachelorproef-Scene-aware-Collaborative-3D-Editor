import { useKeyboardControls, OrbitControls } from '@react-three/drei'
import { useRef, useEffect } from 'react'

const SceneCamera: React.FC = () => {
    const controlsRef = useRef<any>(null);
    const [subscribeKeys] = useKeyboardControls();

    const xCamera = () => {
        if (controlsRef.current) {
            const controls = controlsRef.current;
            const camera = controls.object;

            camera.position.set(10, 0, 0);
            controls.target.set(0, 0, 0);

            controls.update();
        }
    };

    const yCamera = () => {
        if (controlsRef.current) {
            const controls = controlsRef.current;
            const camera = controls.object;

            camera.position.set(0, 10, 0);
            controls.target.set(0, 0, 0);

            controls.update();
        }
    };

    const zCamera = () => {
        if (controlsRef.current) {
            const controls = controlsRef.current;
            const camera = controls.object;

            camera.position.set(0, 0, 10);
            controls.target.set(0, 0, 0);

            controls.update();
        }
    };

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
            (state) => state,
            (state) => {
                if (state.reset) {
                    resetCamera();
                }
                if (state.xcamera) {
                    xCamera();
                }
                if (state.ycamera) {
                    yCamera();
                }
                if (state.zcamera) {
                    zCamera();
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