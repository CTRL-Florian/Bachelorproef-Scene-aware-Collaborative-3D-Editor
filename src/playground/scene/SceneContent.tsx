import { useYjsSceneStore } from './hooks/useYjsSceneStore';
import type { SceneObject } from './hooks/useYjsSceneStore';
import Box from '@/objects/Box';
import { getWorldMatrix, extractRotationFromMatrix } from '@/lib/transformUtils';
import { useMemo } from 'react';

const SceneContent: React.FC = () => {
    const { state } = useYjsSceneStore();

    // Maak een map van id -> object voor snelle lookup
    const objectMap = useMemo(() => {
        const map: Record<string, SceneObject> = {};
        state.objects.forEach(obj => { map[obj.id] = obj; });
        return map;
    }, [state.objects]);

    // Render alle objecten "flat" met hun berekende wereldtransformaties
    // Dit voorkomt dubbele transformaties door Three.js nesting
    return (
        <>
            {state.objects.map(obj => {
                // Bereken wereldmatrix
                const worldMatrix = getWorldMatrix(obj, objectMap);
                // Haal positie uit matrix
                const position: [number, number, number] = [
                    worldMatrix[12],
                    worldMatrix[13],
                    worldMatrix[14]
                ];
                // Haal rotatie uit matrix
                const rotation = extractRotationFromMatrix(worldMatrix);

                return (
                    <Box
                        key={obj.id}
                        id={obj.id}
                        position={position}
                        rotation={rotation}
                        scale={obj.scale}
                        color={obj.color}
                        isSelected={state.selectedObjectId === obj.id}
                    />
                );
            })}
        </>
    );
};

export default SceneContent;