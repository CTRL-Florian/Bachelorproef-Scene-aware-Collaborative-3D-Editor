import React, { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  boxId: string;
  onMove: () => void;
  onResize: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, boxId, onMove, onResize, onRotate, onDuplicate, onDelete, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Controleer of het klik in een submenu is
        const submenus = document.querySelectorAll('[data-submenu="true"]');
        let inSubmenu = false;
        submenus.forEach(submenu => {
          if (submenu.contains(e.target as Node)) {
            inSubmenu = true;
          }
        });
        if (!inSubmenu) {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: y,
        left: x,
        background: "#fff",
        color: "#222",
        borderRadius: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        zIndex: 1000,
        minWidth: 180,
        padding: 12,
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 13 }}>Box ID: {boxId}</div>
      <button style={btnStyle} onClick={onMove}>Move</button>
      <button style={btnStyle} onClick={onResize}>Resize</button>
      <button style={btnStyle} onClick={onRotate}>Rotate</button>
      <button style={btnStyle} onClick={onDuplicate}>Duplicate</button>
      <button style={{ ...btnStyle, color: '#d32f2f' }} onClick={onDelete}>Delete</button>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'none',
  border: 'none',
  color: '#222',
  textAlign: 'left',
  padding: '4px 0',
  cursor: 'pointer',
  fontSize: 13,
  marginBottom: 2,
};

export default ContextMenu;
