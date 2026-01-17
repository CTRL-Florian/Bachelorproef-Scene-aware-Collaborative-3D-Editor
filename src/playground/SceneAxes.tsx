import { GizmoHelper, GizmoViewport } from '@react-three/drei'

const SceneAxes: React.FC = () => {
    return (
        <>
            <axesHelper args={[5]} />

            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="white" />
            </GizmoHelper>
        </>
    );
};

export default SceneAxes;