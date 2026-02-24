import React from "react";
import ViewSettingPopup from "@/popups/ViewSettingPopup";
import AddBoxPopup from "@/popups/AddBoxPopup";
import ActionWheel from "@/popups/ActionWheel";
import MoveBoxPopup from "@/popups/MoveBoxPopup";
import ResizeBoxPopup from "@/popups/ResizeBoxPopup";
import { useContextMenuStore } from "@/popups/hooks/useContextMenuStore";
import { useYjsSceneStore } from "@/playground/scene/hooks/useYjsSceneStore";
import { useLinkModeStore } from "@/playground/hooks/useLinkModeStore";
import RotateBoxPopup from "@/popups/RotateBoxPopup";
import { getCommandManager, MoveObjectCommand, RotateObjectCommand, ScaleObjectCommand, DuplicateObjectCommand, RemoveObjectCommand } from "@/commands";

const Popups: React.FC = () => {
    const { isOpen, x, y, boxId, close } = useContextMenuStore();
    const { getObject } = useYjsSceneStore();
    const { isLinking, startLinking, cancelLinking } = useLinkModeStore();
    const commandManager = getCommandManager();

    // State voor submenu (move, resize, rotate)
    const [activeSubmenu, setActiveSubmenu] = React.useState<null | "move" | "resize" | "rotate">(null);
    
    // Escape toets om link mode te annuleren
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isLinking) {
                cancelLinking();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLinking, cancelLinking]);

    // Handler voor Link: start linking mode
    const handleLink = () => {
        if (boxId) {
            startLinking(boxId);
            close();
        }
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
    const handleMoveBox = (values: [number, number, number], mode: "offset" | "absolute" | "relative") => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (!obj) return;

        let newPos: [number, number, number];

        switch (mode) {
            case "offset":
                // Offset: voeg toe aan huidige lokale positie
                newPos = [
                    obj.position[0] + values[0],
                    obj.position[1] + values[1],
                    obj.position[2] + values[2],
                ];
                break;
            case "relative":
                // Relative: stel lokale positie in (t.o.v. parent)
                // Dit is gewoon de directe waarde want position is al lokaal
                newPos = values;
                break;
            case "absolute":
                // Absolute: wereldcoördinaten -> moeten omgezet worden naar lokaal
                if (obj.parentId) {
                    // Object heeft een parent, we moeten de wereldpositie omzetten naar lokaal
                    // Haal de parent's wereldpositie op en bereken het verschil
                    // Voor nu: we slaan de waarden direct op als lokale positie
                    // Dit vereist dat we de inverse parent transformatie toepassen
                    // Vereenvoudigde versie: we trekken de parent's wereldpositie af
                    const parent = getObject(obj.parentId);
                    if (parent) {
                        // Recursief de wereldpositie van de parent berekenen
                        const getWorldPos = (id: string): [number, number, number] => {
                            const o = getObject(id);
                            if (!o) return [0, 0, 0];
                            if (o.parentId) {
                                const parentWorldPos = getWorldPos(o.parentId);
                                return [
                                    parentWorldPos[0] + o.position[0],
                                    parentWorldPos[1] + o.position[1],
                                    parentWorldPos[2] + o.position[2],
                                ];
                            }
                            return [...o.position] as [number, number, number];
                        };
                        const parentWorldPos = getWorldPos(obj.parentId);
                        newPos = [
                            values[0] - parentWorldPos[0],
                            values[1] - parentWorldPos[1],
                            values[2] - parentWorldPos[2],
                        ];
                    } else {
                        newPos = values;
                    }
                } else {
                    // Geen parent: absolute = lokale positie
                    newPos = values;
                }
                break;
        }

        // Gebruik command voor undo/redo support
        const command = new MoveObjectCommand(
            obj.id,
            obj.position,
            newPos,
            mode
        );
        commandManager.execute(command);
        
        setActiveSubmenu(null);
        close();
    };

    // Handler voor rotate-popup: roteer box
    const handleRotateBox = (values: [number, number, number], mode: "offset" | "absolute") => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            if (Array.isArray(values) && values.length === 3) {
                let newRot: [number, number, number];
                if (mode === "absolute") {
                    newRot = values;
                } else {
                    newRot = [
                        obj.rotation[0] + values[0],
                        obj.rotation[1] + values[1],
                        obj.rotation[2] + values[2],
                    ];
                }
                const command = new RotateObjectCommand(obj.id, obj.rotation, newRot);
                commandManager.execute(command);
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
            const command = new ScaleObjectCommand(obj.id, obj.scale, newScale);
            commandManager.execute(command);
        }
        setActiveSubmenu(null);
        close();
    };
    const handleDuplicate = () => {
        if (!boxId) return;
        const obj = getObject(boxId);
        if (obj) {
            const newId = boxId + '-copy-' + Math.floor(Math.random()*10000);
            const newPosition: [number, number, number] = [obj.position[0]+2, obj.position[1]+1.5, obj.position[2]];
            const command = new DuplicateObjectCommand(boxId, newId, newPosition);
            commandManager.execute(command);
        }
        close();
    };
    const handleDelete = () => {
        if (!boxId) return;
        const command = new RemoveObjectCommand(boxId);
        commandManager.execute(command);
        close();
    };

    return (
        <>
            <ViewSettingPopup />
            <AddBoxPopup />

            {isOpen && boxId && !isLinking && (
                <ActionWheel
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