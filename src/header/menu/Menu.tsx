import { Menubar } from "@/components/ui/menubar"
import FileMenu from "@/header/menu/FileMenu"
import EditMenu from "@/header/menu/EditMenu"
import ViewMenu from "@/header/menu/ViewMenu"
import HelpMenu from "@/header/menu/HelpMenu"
import OptionsMenu from "@/header/menu/OptionsMenu"
import InsertMenu from "@/header/menu/InsertMenu"

const Menu: React.FC = () => {
    return (
        <>
            <Menubar>
                <FileMenu />
                <EditMenu />
                <ViewMenu />
                <InsertMenu />
                <OptionsMenu />
                <HelpMenu />
            </Menubar>
        </>
    );
};

export default Menu;
