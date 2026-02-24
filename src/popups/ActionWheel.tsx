import React, { useEffect, useRef } from "react";
import { 
  Move3D, 
  ZoomIn, 
  RotateCw, 
  Copy, 
  Trash2, 
  Link2,
  X 
} from "lucide-react";

interface ActionWheelProps {
  x: number;
  y: number;
  boxId: string;
  onMove: () => void;
  onResize: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLink: () => void;
  onClose: () => void;
}

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: string;
  angle: number;
}

const ActionWheel: React.FC<ActionWheelProps> = ({
  x,
  y,
  boxId,
  onMove,
  onResize,
  onRotate,
  onDuplicate,
  onDelete,
  onLink,
  onClose,
}) => {
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

  const WHEEL_RADIUS = 80;
  const ICON_SIZE = 24;
  const CENTER_SIZE = 48;

  const actions: Action[] = [
    {
      id: "move",
      label: "Move",
      icon: <Move3D size={ICON_SIZE} />,
      onClick: onMove,
      color: "#3b82f6",
      angle: 0,
    },
    {
      id: "resize",
      label: "Resize",
      icon: <ZoomIn size={ICON_SIZE} />,
      onClick: onResize,
      color: "#10b981",
      angle: 60,
    },
    {
      id: "rotate",
      label: "Rotate",
      icon: <RotateCw size={ICON_SIZE} />,
      onClick: onRotate,
      color: "#f59e0b",
      angle: 120,
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: <Copy size={ICON_SIZE} />,
      onClick: onDuplicate,
      color: "#8b5cf6",
      angle: 180,
    },
    {
      id: "link",
      label: "Link",
      icon: <Link2 size={ICON_SIZE} />,
      onClick: onLink,
      color: "#ec4899",
      angle: 240,
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 size={ICON_SIZE} />,
      onClick: onDelete,
      color: "#ef4444",
      angle: 300,
    },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x - (WHEEL_RADIUS * 2.5) / 2,
        top: y - (WHEEL_RADIUS * 2.5) / 2,
        width: WHEEL_RADIUS * 2.5,
        height: WHEEL_RADIUS * 2.5,
        pointerEvents: "none",
        zIndex: 1000,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Center button */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: CENTER_SIZE,
          height: CENTER_SIZE,
          borderRadius: "50%",
          background: "#1f2937",
          border: "2px solid #374151",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          pointerEvents: "auto",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          transition: "all 0.2s ease",
          zIndex: 10,
        }}
        onClick={onClose}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform =
            "translate(-50%, -50%) scale(1.1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform =
            "translate(-50%, -50%)";
        }}
      >
        <X size={20} color="#9ca3af" />
      </div>

      {/* Action items */}
      {actions.map((action) => {
        const angle = (action.angle * Math.PI) / 180;
        const itemX = Math.cos(angle) * WHEEL_RADIUS;
        const itemY = Math.sin(angle) * WHEEL_RADIUS;

        return (
          <div
            key={action.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${itemX}px), calc(-50% + ${itemY}px))`,
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={() => {
                action.onClick();
                // Sluit niet meteen voor submenu-acties (move, resize, rotate)
                if (!["move", "resize", "rotate"].includes(action.id)) {
                  onClose();
                }
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: action.color,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "white",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s ease",
                transform: "scale(1)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.15)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 4px 16px rgba(0, 0, 0, 0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 2px 8px rgba(0, 0, 0, 0.2)";
              }}
              title={action.label}
            >
              {action.icon}
            </button>
          </div>
        );
      })}

      {/* Box ID display */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, calc(-50% - 70px))",
          fontSize: 12,
          color: "#d1d5db",
          background: "rgba(31, 41, 55, 0.9)",
          padding: "4px 8px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          fontWeight: 500,
        }}
      >
        {boxId}
      </div>
    </div>
  );
};

export default ActionWheel;
