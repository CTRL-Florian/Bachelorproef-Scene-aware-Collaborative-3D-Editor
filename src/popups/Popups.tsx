import React from "react";
import ViewSettingPopup from "@/popups/ViewSettingPopup";
import AddBoxPopup from "@/popups/AddBoxPopup";
import ContextMenu from "@/popups/ContextMenu";
import MoveBoxPopup from "@/popups/MoveBoxPopup";
import ResizeBoxPopup from "@/popups/ResizeBoxPopup";
import { useContextMenuStore } from "@/popups/hooks/useContextMenuStore";
import { useYjsSceneStore } from "@/playground/scene/hooks/useYjsSceneStore";

const Popups: React.FC = () => {
    const { isOpen, x, y, boxId, close } = useContextMenuStore();
    const { getObject, updateObject, addObject, removeObject } = useYjsSceneStore();

    // State voor submenu (move of resize)
    const [activeSubmenu, setActiveSubmenu] = React.useState<null | "move" | "resize">(null);

    // Handler voor move: open submenu
    const handleMove = () => {
        setActiveSubmenu("move");
    };

    // Handler voor move-popup: verplaats box
    const handleMoveBox = (values: [number, number, number]) => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            updateObject(obj.id, {
                position: values,
            });
        }
        setActiveSubmenu(null);
        close();
    };

    // Handler voor resize: open submenu
    const handleResize = () => {
        setActiveSubmenu("resize");
    };

    // Handler voor resize-popup: resize box
    const handleResizeBox = (absolute: [number, number, number], offset: [number, number, number]) => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            const newScale: [number, number, number] = [
                absolute[0] !== 0 ? Math.max(0.1, absolute[0]) : obj.scale[0] + offset[0],
                absolute[1] !== 0 ? Math.max(0.1, absolute[1]) : obj.scale[1] + offset[1],
                absolute[2] !== 0 ? Math.max(0.1, absolute[2]) : obj.scale[2] + offset[2],
            ];
            updateObject(obj.id, { scale: newScale });
        }
        setActiveSubmenu(null);
        close();
    };
    const handleDuplicate = () => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            const newId = boxId + '-copy-' + Math.floor(Math.random()*10000);
            // Offset in x en y
            addObject(
                newId,
                'box',
                [obj.position[0]+2, obj.position[1]+1.5, obj.position[2]],
                obj.rotation,
                obj.scale,
                obj.color
            );
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
                    onClose={() => {
                        close();
                        setActiveSubmenu(null);
                    }}
                />
            )}
            {activeSubmenu === "move" && boxId && isOpen && (
                <MoveBoxPopup
                    x={x + 200}
                    y={y}
                    boxId={boxId}
                    onMove={handleMoveBox}
                    onClose={() => setActiveSubmenu(null)}
                />
            )}
            {activeSubmenu === "resize" && boxId && isOpen && (
                <ResizeBoxPopup
                    x={x + 200}
                    y={y}
                    boxId={boxId}
                    onResize={handleResizeBox}
                    onClose={() => setActiveSubmenu(null)}
                />
            )}
        </>
    );
};

export default Popups;