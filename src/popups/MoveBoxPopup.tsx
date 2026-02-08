import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface MoveBoxPopupProps {
  x: number;
  y: number;
  boxId: string;
  onMove: (values: [number, number, number]) => void;
  onClose: () => void;
}

const MoveBoxPopup: React.FC<MoveBoxPopupProps> = ({ x, y, boxId, onMove, onClose }) => {
  const [mode, setMode] = useState<"offset" | "absolute">("offset");
  const [offset, setOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [absolute, setAbsolute] = useState<[number, number, number]>([0, 0, 0]);
  const ref = useRef<HTMLDivElement>(null);

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
    if (mode === "absolute") {
      onMove(absolute);
    } else {
      // Bereken nieuwe positie: huidge + offset
      // Note: moet in Popups.tsx afgehandeld worden
      onMove(offset);
    }
  };

  return (
    <div ref={ref} data-submenu="true" style={{ position: "fixed", top: y, left: x, zIndex: 1100 }}>
      <Card style={{ background: "#fff", minWidth: 250, padding: 16 }}>
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>Move Box: {boxId}</div>
        <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
          <Button size="sm" variant={mode === "offset" ? "default" : "outline"} onClick={() => setMode("offset")}>Offset</Button>
          <Button size="sm" variant={mode === "absolute" ? "default" : "outline"} onClick={() => setMode("absolute")}>Absolute</Button>
        </div>
        {mode === "offset" ? (
          <>
            <div style={{ marginBottom: 8 }}>
              <label>X Offset: <input type="number" value={offset[0]} onChange={e => setOffset([Number(e.target.value), offset[1], offset[2]])} style={{ width: 60, marginLeft: 4 }}/></label>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label>Y Offset: <input type="number" value={offset[1]} onChange={e => setOffset([offset[0], Number(e.target.value), offset[2]])} style={{ width: 60, marginLeft: 4 }}/></label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Z Offset: <input type="number" value={offset[2]} onChange={e => setOffset([offset[0], offset[1], Number(e.target.value)])} style={{ width: 60, marginLeft: 4 }}/></label>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <label>X: <input type="number" value={absolute[0]} onChange={e => setAbsolute([Number(e.target.value), absolute[1], absolute[2]])} style={{ width: 60, marginLeft: 4 }}/></label>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label>Y: <input type="number" value={absolute[1]} onChange={e => setAbsolute([absolute[0], Number(e.target.value), absolute[2]])} style={{ width: 60, marginLeft: 4 }}/></label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Z: <input type="number" value={absolute[2]} onChange={e => setAbsolute([absolute[0], absolute[1], Number(e.target.value)])} style={{ width: 60, marginLeft: 4 }}/></label>
            </div>
          </>
        )}
        <Button variant="outline" style={{ marginRight: 8 }} onClick={handleMoveSubmit}>Move</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </Card>
    </div>
  );
};

export default MoveBoxPopup;
