import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"

const HelpMenu: React.FC = () => {
    return (
        <>
            <MenubarMenu>
                <MenubarTrigger>Help</MenubarTrigger>
                <MenubarContent>
                <MenubarItem>Documentation</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </>
    );
};

export default HelpMenu;