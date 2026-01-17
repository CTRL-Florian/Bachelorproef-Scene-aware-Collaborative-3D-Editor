import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const Box: React.FC<any> = (props) => {
    const meshRef = useRef<THREE.Mesh>(null!) 
  
    useFrame((state, delta) => {
        const speed = 0.5;
        meshRef.current.rotation.x += delta * speed;
        meshRef.current.rotation.y += delta * speed;
    })

    const [clicked, setClicked] = React.useState(false);

    return (
        <mesh 
            onClick={(event) => {
                event.stopPropagation();
                setClicked(!clicked);
                console.log('Box clicked');
            }}
            {...props} ref={meshRef}
        >
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color={clicked ? 'royalblue' :'orange'} />
        </mesh>
    );
};

export default Box;