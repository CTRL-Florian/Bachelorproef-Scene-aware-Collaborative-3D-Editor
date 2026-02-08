import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

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
    <div ref={ref} data-submenu="true" style={{ position: "fixed", top: (() => {
      let adjustedY = y;
      if (adjustedY + 300 > window.innerHeight) {
        adjustedY = window.innerHeight - 300 - 10;
      }
      return adjustedY;
    })(), left: (() => {
      let adjustedX = x;
      if (adjustedX + 200 > window.innerWidth) {
        adjustedX = window.innerWidth - 200 - 10;
      }
      return adjustedX;
    })(), zIndex: 1100 }}>
      <div style={{ background: "#fff", minWidth: 200, padding: 12, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", borderRadius: 6 }}>
        <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 13 }}>Move: {boxId}</div>
        <div style={{ marginBottom: 6, display: "flex", gap: 4 }}>
          <Button size="sm" variant={mode === "offset" ? "default" : "outline"} onClick={() => setMode("offset")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Offset</Button>
          <Button size="sm" variant={mode === "absolute" ? "default" : "outline"} onClick={() => setMode("absolute")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Absolute</Button>
        </div>
        {mode === "offset" ? (
          <>
            <div style={{ marginBottom: 2 }}>
              <label style={{ fontSize: 12 }}>X: <input type="number" value={offset[0]} onChange={e => setOffset([Number(e.target.value), offset[1], offset[2]])} style={{ width: 50, marginLeft: 4, fontSize: 12 }}/></label>
            </div>
            <div style={{ marginBottom: 2 }}>
              <label style={{ fontSize: 12 }}>Y: <input type="number" value={offset[1]} onChange={e => setOffset([offset[0], Number(e.target.value), offset[2]])} style={{ width: 50, marginLeft: 4, fontSize: 12 }}/></label>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 12 }}>Z: <input type="number" value={offset[2]} onChange={e => setOffset([offset[0], offset[1], Number(e.target.value)])} style={{ width: 50, marginLeft: 4, fontSize: 12 }}/></label>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 2 }}>
              <label style={{ fontSize: 12 }}>X: <input type="number" value={absolute[0]} onChange={e => setAbsolute([Number(e.target.value), absolute[1], absolute[2]])} style={{ width: 50, marginLeft: 4, fontSize: 12 }}/></label>
            </div>
            <div style={{ marginBottom: 2 }}>
              <label style={{ fontSize: 12 }}>Y: <input type="number" value={absolute[1]} onChange={e => setAbsolute([absolute[0], Number(e.target.value), absolute[2]])} style={{ width: 50, marginLeft: 4, fontSize: 12 }}/></label>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 12 }}>Z: <input type="number" value={absolute[2]} onChange={e => setAbsolute([absolute[0], absolute[1], Number(e.target.value)])} style={{ width: 50, marginLeft: 4, fontSize: 12 }}/></label>
            </div>
          </>
        )}
        <Button size="sm" variant="outline" onClick={handleMoveSubmit} style={{ fontSize: 12, padding: "4px 8px", height: "auto", width: "100%" }}>Move</Button>
      </div>
    </div>
  );
};

export default MoveBoxPopup;
