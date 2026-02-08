import { useSceneSettingsStore } from "@/playground/scene/hooks/useSceneSettingsStore";

const SceneSettings: React.FC = () => {
    const bgColor = useSceneSettingsStore((state) => state.color);

    return (
        <>
            <color attach="background" args={[bgColor]} />
            <ambientLight intensity={0.5} />
        </>
    );
};

export default SceneSettings;