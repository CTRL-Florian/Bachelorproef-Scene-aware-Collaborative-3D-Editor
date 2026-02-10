import { useYjsSceneStore } from './hooks/useYjsSceneStore';
import Box from '@/objects/Box';
import { getWorldMatrix } from '@/lib/transformUtils';
import { useMemo } from 'react';
import { mat4 } from 'gl-matrix';

const SceneContent: React.FC = () => {
    const { state } = useYjsSceneStore();
    // Maak een map van id -> object voor snelle lookup
    const objectMap = useMemo(() => {
        const map: Record<string, any> = {};
        state.objects.forEach(obj => { map[obj.id] = obj; });
        return map;
    }, [state.objects]);

    // Vind root objects (zonder parent)
    const rootObjects = state.objects.filter(obj => !obj.parentId);

    // Recursief renderen
    function renderBoxTree(obj: any) {
        // Bereken wereldmatrix
        const worldMatrix = getWorldMatrix(obj, objectMap);
        // Haal positie, rotatie, schaal uit matrix (vereenvoudigd: alleen positie)
        const position = [worldMatrix[12], worldMatrix[13], worldMatrix[14]];
        // TODO: rotatie uit matrix halen indien nodig
        return (
            <Box
                key={obj.id}
                id={obj.id}
                position={position as [number, number, number]}
                rotation={obj.rotation}
                scale={obj.scale}
                color={obj.color}
                isSelected={state.selectedObjectId === obj.id}
            >
                {obj.childIds && obj.childIds.map((cid: string) => objectMap[cid] && renderBoxTree(objectMap[cid]))}
            </Box>
        );
    }

    return <>{rootObjects.map(renderBoxTree)}</>;
};

export default SceneContent;