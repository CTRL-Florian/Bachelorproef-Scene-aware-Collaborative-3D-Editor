import ViewSettingPopup from "@/popups/ViewSettingPopup";
import AddBoxPopup from "@/popups/AddBoxPopup";
import ContextMenu from "@/popups/ContextMenu";
import { useContextMenuStore } from "@/popups/hooks/useContextMenuStore";
import { useYjsSceneStore } from "@/playground/scene/hooks/useYjsSceneStore";

const Popups: React.FC = () => {
    const { isOpen, x, y, boxId, close } = useContextMenuStore();
    const { getObject, updateObject, addObject, removeObject } = useYjsSceneStore();

    // Handlers voor contextmenu acties
    const handleMove = () => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) updateObject(obj.id, { position: [obj.position[0]+1, obj.position[1], obj.position[2]] });
        close();
    };
    const handleResize = () => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) updateObject(obj.id, { scale: [obj.scale[0]+0.5, obj.scale[1]+0.5, obj.scale[2]+0.5] });
        close();
    };
    const handleDuplicate = () => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            const newId = boxId + '-copy-' + Math.floor(Math.random()*10000);
            addObject(newId, 'box', [obj.position[0]+2, obj.position[1], obj.position[2]], obj.rotation, obj.scale, obj.color);
        }
        close();
    };
    const handleDelete = () => {
        if (!boxId) return;
        removeObject(boxId);
        close();
    };

    return (
        <>
            <ViewSettingPopup />
            <AddBoxPopup />
            {isOpen && boxId && (
                <ContextMenu
                    x={x}
                    y={y}
                    boxId={boxId}
                    onMove={handleMove}
                    onResize={handleResize}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onClose={close}
                />
            )}
        </>
    );
};

export default Popups;