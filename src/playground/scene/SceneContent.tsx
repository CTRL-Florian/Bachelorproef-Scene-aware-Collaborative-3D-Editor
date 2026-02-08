import { useYjsSceneStore } from './hooks/useYjsSceneStore'
import Box from '@/objects/Box'

const SceneContent: React.FC = () => {
    const { state } = useYjsSceneStore();

    return (
        <>
            {state.objects.map((obj) => (
                <Box
                    key={obj.id}
                    id={obj.id}
                    position={obj.position}
                    rotation={obj.rotation}
                    scale={obj.scale}
                    color={obj.color}
                    isSelected={state.selectedObjectId === obj.id}
                />
            ))}
        </>
    );
};

export default SceneContent;