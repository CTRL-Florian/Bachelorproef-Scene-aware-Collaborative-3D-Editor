import React, { useState } from 'react'
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
    isSelected = false,
}) => {
    const [clicked, setClicked] = useState(false);
    const { updateObjectColor } = useYjsSceneStore();

    const handleClick = (event: any) => {
        event.stopPropagation();
        const newClicked = !clicked;
        setClicked(newClicked);
        // Update color in Y.js store when selected/deselected
        updateObjectColor(id, newClicked ? 'royalblue' : color);
        console.log(`Box ${id} clicked`);
    };

    return (
        <mesh 
            onClick={(event) => {
                event.stopPropagation();
                setClicked(!clicked);
                console.log('Box clicked');
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