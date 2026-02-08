import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const EditMenu: React.FC = () => {
    return (
        <>
            <MenubarMenu>
                <MenubarTrigger>Edit</MenubarTrigger>
                <MenubarContent>
                <MenubarItem>
                    Undo <MenubarShortcut><KbdGroup> <Kbd>CTRL</Kbd> <span>+</span> <Kbd>Z</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                <MenubarItem>
                    Redo <MenubarShortcut><KbdGroup> <Kbd>CTRL</Kbd> <span>+</span> <Kbd>Y</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </>
    );
};

export default EditMenu;