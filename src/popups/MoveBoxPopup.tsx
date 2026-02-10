import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useYjsSceneStore } from "@/playground/scene/hooks/useYjsSceneStore";

interface MoveBoxPopupProps {
  x: number;
  y: number;
  boxId: string;
  onMove: (values: [number, number, number], mode: "offset" | "absolute" | "relative") => void;
  onClose: () => void;
}

const MoveBoxPopup: React.FC<MoveBoxPopupProps> = ({ x, y, boxId, onMove, onClose }) => {
  const { getObject } = useYjsSceneStore();
  const obj = getObject(boxId);
  const hasParent = obj?.parentId != null;

  const [mode, setMode] = useState<"offset" | "absolute" | "relative">("offset");
  const [values, setValues] = useState<[number, number, number]>([0, 0, 0]);
  const ref = useRef<HTMLDivElement>(null);

  // Initialiseer values op basis van mode
  useEffect(() => {
    if (mode === "absolute" && obj) {
      // Voor absolute: toon huidige lokale positie als startwaarde
      setValues([...obj.position] as [number, number, number]);
    } else if (mode === "relative" && obj) {
      // Voor relative: toon huidige lokale positie (t.o.v. parent)
      setValues([...obj.position] as [number, number, number]);
    } else {
      setValues([0, 0, 0]);
    }
  }, [mode, obj]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleMoveSubmit = () => {
    onMove(values, mode);
  };

  const getModeDescription = () => {
    switch (mode) {
      case "offset": return "Move by offset from current position";
      case "absolute": return "Set position relative to world origin";
      case "relative": return "Set position relative to parent";
    }
  };

  return (
    <div ref={ref} data-submenu="true" style={{ position: "fixed", top: (() => {
      let adjustedY = y;
      if (adjustedY + 350 > window.innerHeight) {
        adjustedY = window.innerHeight - 350 - 10;
      }
      return adjustedY;
    })(), left: (() => {
      let adjustedX = x;
      if (adjustedX + 220 > window.innerWidth) {
        adjustedX = window.innerWidth - 220 - 10;
      }
      return adjustedX;
    })(), zIndex: 1100 }}>
      <div style={{ background: "#fff", minWidth: 210, padding: 12, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", borderRadius: 6 }}>
        <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 13 }}>Move: {boxId}</div>
        <div style={{ marginBottom: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Button size="sm" variant={mode === "offset" ? "default" : "outline"} onClick={() => setMode("offset")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Offset</Button>
          <Button size="sm" variant={mode === "absolute" ? "default" : "outline"} onClick={() => setMode("absolute")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Absolute</Button>
          {hasParent && (
            <Button size="sm" variant={mode === "relative" ? "default" : "outline"} onClick={() => setMode("relative")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Relative</Button>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>{getModeDescription()}</div>
        <div style={{ marginBottom: 2 }}>
          <label style={{ fontSize: 12 }}>X: <input type="number" step="0.1" value={values[0]} onChange={e => setValues([Number(e.target.value), values[1], values[2]])} style={{ width: 60, marginLeft: 4, fontSize: 12 }}/></label>
        </div>
        <div style={{ marginBottom: 2 }}>
          <label style={{ fontSize: 12 }}>Y: <input type="number" step="0.1" value={values[1]} onChange={e => setValues([values[0], Number(e.target.value), values[2]])} style={{ width: 60, marginLeft: 4, fontSize: 12 }}/></label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12 }}>Z: <input type="number" step="0.1" value={values[2]} onChange={e => setValues([values[0], values[1], Number(e.target.value)])} style={{ width: 60, marginLeft: 4, fontSize: 12 }}/></label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="outline" onClick={onClose} style={{ fontSize: 12, padding: "4px 8px", height: "auto", flex: 1 }}>Cancel</Button>
          <Button size="sm" onClick={handleMoveSubmit} style={{ fontSize: 12, padding: "4px 8px", height: "auto", flex: 1 }}>Move</Button>
        </div>
      </div>
    </div>
  );
};

export default MoveBoxPopup;
