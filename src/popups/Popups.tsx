import React from "react";
import ViewSettingPopup from "@/popups/ViewSettingPopup";
import AddBoxPopup from "@/popups/AddBoxPopup";
import ContextMenu from "@/popups/ContextMenu";
import MoveBoxPopup from "@/popups/MoveBoxPopup";
import ResizeBoxPopup from "@/popups/ResizeBoxPopup";
import { useContextMenuStore } from "@/popups/hooks/useContextMenuStore";
import { useYjsSceneStore } from "@/playground/scene/hooks/useYjsSceneStore";
import RotateBoxPopup from "@/popups/RotateBoxPopup";

const Popups: React.FC = () => {
    const { isOpen, x, y, boxId, close } = useContextMenuStore();
    const { state, getObject, updateObject, addObject, removeObject, linkObject } = useYjsSceneStore();

    // State voor submenu (move, resize, rotate)
    const [activeSubmenu, setActiveSubmenu] = React.useState<null | "move" | "resize" | "rotate" | "link">(null);
    const [linkSourceId, setLinkSourceId] = React.useState<string | null>(null);
    // Handler voor Link: start linking mode
    const handleLink = () => {
        setLinkSourceId(boxId);
        setActiveSubmenu("link");
    };

    // Handler voor het selecteren van een parent box om te linken
    const handleSelectParent = (parentId: string) => {
        if (linkSourceId && parentId && linkSourceId !== parentId) {
            linkObject(linkSourceId, parentId);
        }
        setLinkSourceId(null);
        setActiveSubmenu(null);
        close();
    };

    // Handler voor move: open submenu
    const handleMove = () => {
        setActiveSubmenu("move");
    };

    // Handler voor rotate: open submenu
    const handleRotate = () => {
        setActiveSubmenu("rotate");
    };

    // Handler voor move-popup: verplaats box
    const handleMoveBox = (values: [number, number, number]) => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            // Offset of absolute?
            if (Array.isArray(values) && values.length === 3) {
                // Als offset, tel op bij huidige positie
                const newPos: [number, number, number] = [
                    obj.position[0] + values[0],
                    obj.position[1] + values[1],
                    obj.position[2] + values[2],
                ];
                updateObject(obj.id, { position: newPos });
            }
        }
        setActiveSubmenu(null);
        close();
    };

    // Handler voor rotate-popup: roteer box
    const handleRotateBox = (values: [number, number, number]) => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            // Offset of absolute?
            if (Array.isArray(values) && values.length === 3) {
                // Als offset, tel op bij huidige rotatie
                const newRot: [number, number, number] = [
                    obj.rotation[0] + values[0],
                    obj.rotation[1] + values[1],
                    obj.rotation[2] + values[2],
                ];
                updateObject(obj.id, { rotation: newRot });
            }
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
            {isOpen && boxId && !linkSourceId && (
                <ContextMenu
                    x={x}
                    y={y}
                    boxId={boxId}
                    onMove={handleMove}
                    onResize={handleResize}
                    onRotate={handleRotate}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onLink={handleLink}
                    onClose={() => {
                        close();
                        setActiveSubmenu(null);
                    }}
                />
            )}
            {/* Link mode: klik op een andere box om te linken */}
            {activeSubmenu === "link" && linkSourceId && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000, background: 'rgba(0,0,0,0.05)' }}
                    onClick={() => { setLinkSourceId(null); setActiveSubmenu(null); }}>
                    <div style={{ position: 'absolute', top: y, left: x + 200, background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Select parent box</div>
                        {state.objects.filter(obj => obj.id !== linkSourceId).map(obj => (
                            <button key={obj.id} style={{ display: 'block', marginBottom: 4, width: '100%' }} onClick={e => { e.stopPropagation(); handleSelectParent(obj.id); }}>{obj.id}</button>
                        ))}
                        <button style={{ marginTop: 8, color: '#888' }} onClick={e => { e.stopPropagation(); setLinkSourceId(null); setActiveSubmenu(null); }}>Cancel</button>
                    </div>
                </div>
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
            {activeSubmenu === "rotate" && boxId && isOpen && (
                <RotateBoxPopup
                    x={x + 200}
                    y={y}
                    boxId={boxId}
                    onRotate={handleRotateBox}
                    onClose={() => setActiveSubmenu(null)}
                />
            )}
        </>
    );
};

export default Popups;