const SceneGrid: React.FC = () => {
    return (
        <gridHelper 
            args={[20, 20, 0x888888, 0x444444]} 
            position={[0, 0, 0]}
        />
    );
};

export default SceneGrid;
