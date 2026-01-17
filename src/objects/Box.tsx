import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const Box: React.FC<any> = (props) => {
    const [clicked, setClicked] = React.useState(false);

    return (
        <mesh 
            onClick={(event) => {
                event.stopPropagation();
                setClicked(!clicked);
                console.log('Box clicked');
            }}
        >
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color={clicked ? 'royalblue' :'orange'} />
        </mesh>
    );
};

export default Box;