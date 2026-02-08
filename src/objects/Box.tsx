import React, { useState } from 'react'
import { useYjsSceneStore } from '@/playground/scene/hooks/useYjsSceneStore'
import { useContextMenuStore } from '@/popups/hooks/useContextMenuStore'

interface BoxProps {
    id: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    color?: string;
    isSelected?: boolean;
}


const Box: React.FC<BoxProps> = ({
    id,
    position,
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    color = 'orange',
    // isSelected = false, // niet gebruikt
}) => {
    const [clicked, setClicked] = useState(false);
    const openContextMenu = useContextMenuStore((s) => s.open);
    const { removeObject, updateObject, addObject, getObject } = useYjsSceneStore();

    // Acties
    // Acties worden nu centraal afgehandeld

    return (
        <mesh
            onClick={(event) => {
                event.stopPropagation();
                setClicked(!clicked);
            }}
            onContextMenu={(event) => {
                event.stopPropagation();
                openContextMenu((event as any).clientX ?? 0, (event as any).clientY ?? 0, id);
            }}
            position={position}
            rotation={rotation}
            scale={scale}
        >
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color={clicked ? 'royalblue' : color} />
        </mesh>
    );
};

export default Box;