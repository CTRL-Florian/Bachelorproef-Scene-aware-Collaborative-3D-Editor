import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
  MenubarShortcut,
} from "@/components/ui/menubar"
import { useAddBoxPopupStore } from "@/popups/hooks/useAddBoxPopupStore"
import { useEffect } from "react"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const InsertMenu: React.FC = () => {
    const toggle = useAddBoxPopupStore((state) => state.toggle);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Alleen bij Ctrl + i (of Ctrl + I)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
                e.preventDefault();
                toggle();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [toggle]);

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
