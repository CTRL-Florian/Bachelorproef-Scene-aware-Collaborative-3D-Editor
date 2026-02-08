import React from "react";

interface ContextMenuProps {
	x: number;
	y: number;
	boxId: string;
	onMove: () => void;
	onResize: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, boxId, onMove, onResize, onDuplicate, onDelete, onClose }) => {
	return (
		<div
			style={{
				position: "fixed",
				top: y,
				left: x,
				background: "#222",
				color: "#fff",
				borderRadius: 6,
				boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
				zIndex: 1000,
				minWidth: 160,
				padding: 8,
			}}
			onContextMenu={e => e.preventDefault()}
		>
			<div style={{ fontWeight: "bold", marginBottom: 8 }}>Box ID: {boxId}</div>
			<button style={btnStyle} onClick={onMove}>Move</button>
			<button style={btnStyle} onClick={onResize}>Resize</button>
			<button style={btnStyle} onClick={onDuplicate}>Duplicate</button>
			<button style={btnStyle} onClick={onDelete}>Delete</button>
			<button style={{ ...btnStyle, color: '#aaa' }} onClick={onClose}>Close</button>
		</div>
	);
};

const btnStyle: React.CSSProperties = {
	display: 'block',
	width: '100%',
	background: 'none',
	border: 'none',
	color: '#fff',
	textAlign: 'left',
	padding: '6px 0',
	cursor: 'pointer',
	fontSize: 15,
};

export default ContextMenu;
