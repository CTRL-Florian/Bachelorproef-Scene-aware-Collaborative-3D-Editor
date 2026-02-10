import React, { useState } from "react";
import { Button } from "@/components/ui/button";

interface RotateBoxPopupProps {
  x: number;
  y: number;
  boxId: string;
  onRotate: (values: [number, number, number]) => void;
  onClose: () => void;
}

const RotateBoxPopup: React.FC<RotateBoxPopupProps> = ({ x, y, boxId, onRotate, onClose }) => {
  const [mode, setMode] = useState<"offset" | "absolute">("offset");
  // Waarden in graden!
  const [offset, setOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [absolute, setAbsolute] = useState<[number, number, number]>([0, 0, 0]);

  // Helper: graden naar radialen
  const degToRad = (deg: number) => deg * Math.PI / 180;

  const handleRotate = () => {
    if (mode === "absolute") {
      onRotate([
        degToRad(absolute[0]),
        degToRad(absolute[1]),
        degToRad(absolute[2])
      ]);
    } else {
      onRotate([
        degToRad(offset[0]),
        degToRad(offset[1]),
        degToRad(offset[2])
      ]);
    }
    onClose();
  };

  return (
    <div data-submenu="true" style={{ position: "fixed", top: y, left: x, background: "#fff", color: "#222", borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.12)", zIndex: 1100, minWidth: 220, padding: 14 }}>
      <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 13 }}>Rotate Box: {boxId}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Button size="sm" variant={mode === "offset" ? "default" : "outline"} onClick={() => setMode("offset")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Offset</Button>
        <Button size="sm" variant={mode === "absolute" ? "default" : "outline"} onClick={() => setMode("absolute")} style={{ fontSize: 11, padding: "2px 6px", height: "auto" }}>Absolute</Button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 12, marginBottom: 2 }}>X (°): </label>
            <input type="number" step="1" value={mode === "offset" ? offset[0] : absolute[0]} onChange={e => {
              const v = parseFloat(e.target.value) || 0;
              mode === "offset" ? setOffset([v, offset[1], offset[2]]) : setAbsolute([v, absolute[1], absolute[2]]);
            }} style={{ width: 60, marginLeft: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, marginBottom: 2 }}>Y (°): </label>
            <input type="number" step="1" value={mode === "offset" ? offset[1] : absolute[1]} onChange={e => {
              const v = parseFloat(e.target.value) || 0;
              mode === "offset" ? setOffset([offset[0], v, offset[2]]) : setAbsolute([absolute[0], v, absolute[2]]);
            }} style={{ width: 60, marginLeft: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, marginBottom: 2 }}>Z (°): </label>
            <input type="number" step="1" value={mode === "offset" ? offset[2] : absolute[2]} onChange={e => {
              const v = parseFloat(e.target.value) || 0;
              mode === "offset" ? setOffset([offset[0], offset[1], v]) : setAbsolute([absolute[0], absolute[1], v]);
            }} style={{ width: 60, marginLeft: 4 }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button size="sm" variant="outline" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button size="sm" onClick={handleRotate} style={{ flex: 1 }}>Apply</Button>
      </div>
    </div>
  );
};

export default RotateBoxPopup;
