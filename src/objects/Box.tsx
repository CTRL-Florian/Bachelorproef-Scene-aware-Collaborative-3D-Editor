import React, { useState } from 'react'
import { useContextMenuStore } from '@/popups/hooks/useContextMenuStore'
import { useLinkModeStore } from '@/playground/hooks/useLinkModeStore'
import { useYjsSceneStore } from '@/playground/scene/hooks/useYjsSceneStore'

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
    
    // Link mode state
    const { isLinking, sourceId, completeLinking } = useLinkModeStore();
    const { linkObject } = useYjsSceneStore();
    
    const isSource = sourceId === id;
    const canBeTarget = isLinking && !isSource;

    const handleClick = (event: any) => {
        event.stopPropagation();
        
        // Als we in link mode zijn en dit is een potentiële target
        if (canBeTarget && sourceId) {
            linkObject(sourceId, id);
            completeLinking();
            return;
        }
        
        // Normale click gedrag
        setClicked(!clicked);
    };

    // Bepaal de kleur op basis van state
    let displayColor = clicked ? 'royalblue' : color;
    if (isSource) {
        displayColor = '#f59e0b'; // Amber voor source
    } else if (canBeTarget) {
        displayColor = '#22c55e'; // Groen voor potentiële targets
    }

    return (
        <mesh
            onClick={handleClick}
            onContextMenu={(event) => {
                event.stopPropagation();
                // Geen context menu in link mode
                if (isLinking) return;
                openContextMenu((event as any).clientX ?? 0, (event as any).clientY ?? 0, id);
            }}
            position={position}
            rotation={rotation}
            scale={scale}
        >
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color={displayColor} />
        </mesh>
    );
};

export default Box;