import Box from '@/objects/Box'
import { Canvas } from '@react-three/fiber';

const ViewPort: React.FC = () => {
    return (
        <Canvas>
            <color attach="background" args={['#9ca3af']} />
            <ambientLight intensity={0.5} />
            <Box position={[0, 0, 0]} />
        </Canvas>
    );
};

export default ViewPort;