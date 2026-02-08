import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
  MenubarShortcut,
} from "@/components/ui/menubar"
import { useAddBoxPopupStore } from "@/popups/hooks/useAddBoxPopupStore"
import { useEffect } from "react"
import { useKeyboardControls } from "@react-three/drei"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const InsertMenu: React.FC = () => {
    const toggle = useAddBoxPopupStore((state) => state.toggle);
    const [subscribeKeys] = useKeyboardControls();

    useEffect(() => {
        return subscribeKeys(
            (state) => state,
            (state) => {
                if (state.addbox) {
                    toggle();
                }
            }
        );
    }, [subscribeKeys, toggle]);

    return (
        <>
            <MenubarMenu>
                <MenubarTrigger>Insert</MenubarTrigger>
                <MenubarContent>
                <MenubarItem onClick={toggle}>
                    Add Box <MenubarShortcut><KbdGroup> <Kbd>CTRL</Kbd> <span>+</span> <Kbd>I</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </>
    );
};

export default InsertMenu;
