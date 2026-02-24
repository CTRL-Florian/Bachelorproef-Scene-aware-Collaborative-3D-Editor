import { OrbitControls } from '@react-three/drei'
import { useRef, useEffect } from 'react'

const SceneCamera: React.FC = () => {
    const controlsRef = useRef<any>(null);

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
        // Handle keyboard shortcuts for camera - skip if Ctrl/Meta is pressed
        const handleKeyDown = (event: KeyboardEvent) => {
            // Skip if modifier keys are pressed (for undo/redo etc)
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            
            // Skip if in input field
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            switch (event.key.toLowerCase()) {
                case 'r':
                    resetCamera();
                    break;
                case 'x':
                    xCamera();
                    break;
                case 'y':
                    yCamera();
                    break;
                case 'z':
                    zCamera();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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