import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { useSceneSettingsStore } from "@/playground/scene/hooks/useSceneSettingsStore";
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const OptionsMenu: React.FC = () => {
    const toggleSettings = useSceneSettingsStore((state) => state.toggle);

    return (
        <>
            <MenubarMenu>
                <MenubarTrigger>Options</MenubarTrigger>
                <MenubarContent>
                <MenubarItem onClick={toggleSettings}>
                    View settings <MenubarShortcut><KbdGroup> <Kbd>Maj⇧</Kbd> <span>+</span> <Kbd>V</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </>
    );
};

export default OptionsMenu;