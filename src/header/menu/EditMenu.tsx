import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useCommandHistory } from "@/commands"

const EditMenu: React.FC = () => {
    const { undo, redo, canUndo, canRedo, undoCommand, redoCommand, undoCount, redoCount } = useCommandHistory();

    return (
        <>
            <MenubarMenu>
                <MenubarTrigger>Edit</MenubarTrigger>
                <MenubarContent>
                <MenubarItem 
                    onClick={undo} 
                    disabled={!canUndo}
                    className={!canUndo ? "opacity-50 cursor-not-allowed" : ""}
                >
                    {undoCommand ? `Undo: ${undoCommand.description}` : "Undo"}
                    <MenubarShortcut><KbdGroup> <Kbd>CTRL</Kbd> <span>+</span> <Kbd>Z</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                <MenubarItem 
                    onClick={redo} 
                    disabled={!canRedo}
                    className={!canRedo ? "opacity-50 cursor-not-allowed" : ""}
                >
                    {redoCommand ? `Redo: ${redoCommand.description}` : "Redo"}
                    <MenubarShortcut><KbdGroup> <Kbd>CTRL</Kbd> <span>+</span> <Kbd>Y</Kbd> </KbdGroup></MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem disabled className="text-xs text-muted-foreground">
                    History: {undoCount} undo, {redoCount} redo available
                </MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </>
    );
};

export default EditMenu;