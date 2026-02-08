import { GizmoHelper, GizmoViewport } from '@react-three/drei'

const SceneAxes: React.FC = () => {
    return (
        <>
            <axesHelper args={[5]} />

            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport 
                    axisColors={['#ff3050', '#60f740', '#2080ff']} 
                    labelColor="white" 
                    hideNegativeAxes
                />
            </GizmoHelper>
        </>
    );
};

export default SceneAxes;