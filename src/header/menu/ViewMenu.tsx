import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const ViewMenu: React.FC = () => {
    return (
        <>
            <MenubarMenu>
                <MenubarTrigger>View</MenubarTrigger>
                <MenubarContent>
                <MenubarItem>
                    Camera X-axis <MenubarShortcut><KbdGroup><Kbd>X</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                <MenubarItem>
                    Camera Y-axis <MenubarShortcut><KbdGroup> <Kbd>Y</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                <MenubarItem>
                    Camera Z-axis <MenubarShortcut><KbdGroup> <Kbd>Z</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                <MenubarItem>
                    Reset camera <MenubarShortcut><Kbd>R</Kbd></MenubarShortcut>
                </MenubarItem>

                <MenubarSeparator />

                <MenubarItem>
                    Toggle axes <MenubarShortcut> <Kbd>B</Kbd> </MenubarShortcut>
                </MenubarItem>
                <MenubarItem>
                    Toggle orbit <MenubarShortcut> <Kbd>N</Kbd> </MenubarShortcut>
                </MenubarItem>

                </MenubarContent>
            </MenubarMenu>
        </>
    );
};

export default ViewMenu;