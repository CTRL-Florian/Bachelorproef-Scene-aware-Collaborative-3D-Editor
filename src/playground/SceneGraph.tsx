import React from 'react';
import { useYjsSceneStore } from './scene/hooks/useYjsSceneStore';
import type { SceneObject } from './scene/hooks/useYjsSceneStore';
import { useLinkModeStore } from './hooks/useLinkModeStore';

interface SceneGraphNodeProps {
    object: SceneObject;
    objectMap: Record<string, SceneObject>;
    level: number;
}

const SceneGraphNode: React.FC<SceneGraphNodeProps> = ({ object, objectMap, level }) => {
    const { isLinking, sourceId } = useLinkModeStore();
    const { linkObject } = useYjsSceneStore();
    const completeLinking = useLinkModeStore((s) => s.completeLinking);

    const children = object.childIds
        ?.map(id => objectMap[id])
        .filter(Boolean) || [];

    const isSource = sourceId === object.id;
    const canBeTarget = isLinking && !isSource;

    const handleClick = () => {
        if (canBeTarget && sourceId) {
            linkObject(sourceId, object.id);
            completeLinking();
        }
    };

    return (
        <div style={{ marginLeft: level * 16 }}>
            <div
                onClick={handleClick}
                style={{
                    padding: '4px 8px',
                    marginBottom: 2,
                    borderRadius: 4,
                    background: isSource ? '#fef3c7' : canBeTarget ? '#dcfce7' : '#f3f4f6',
                    border: isSource ? '2px solid #f59e0b' : canBeTarget ? '2px dashed #22c55e' : '1px solid #e5e7eb',
                    cursor: canBeTarget ? 'pointer' : 'default',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}
            >
                <span style={{ 
                    width: 10, 
                    height: 10, 
                    borderRadius: 2, 
                    background: object.color || 'orange',
                    display: 'inline-block',
                    flexShrink: 0,
                }} />
                <span style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    flex: 1,
                }}>
                    {object.id}
                </span>
                {children.length > 0 && (
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>
                        ({children.length})
                    </span>
                )}
            </div>
            {children.map(child => (
                <SceneGraphNode
                    key={child.id}
                    object={child}
                    objectMap={objectMap}
                    level={level + 1}
                />
            ))}
        </div>
    );
};

const SceneGraph: React.FC = () => {
    const { state } = useYjsSceneStore();
    const { isLinking, sourceId, cancelLinking } = useLinkModeStore();

    // Maak een map voor snelle lookup
    const objectMap = React.useMemo(() => {
        const map: Record<string, SceneObject> = {};
        state.objects.forEach(obj => { map[obj.id] = obj; });
        return map;
    }, [state.objects]);

    // Vind root objects (zonder parent)
    const rootObjects = state.objects.filter(obj => !obj.parentId);

    return (
        <div style={{
            width: 250,
            height: '100%',
            background: '#fff',
            borderLeft: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: 600,
                fontSize: 14,
                color: '#374151',
            }}>
                Scene Graph
            </div>
            
            {/* Link mode indicator */}
            {isLinking && (
                <div style={{
                    padding: '8px 16px',
                    background: '#fef3c7',
                    borderBottom: '1px solid #fcd34d',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <span>
                        <strong>Link mode:</strong> Select parent for {sourceId}
                    </span>
                    <button
                        onClick={cancelLinking}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#b45309',
                            cursor: 'pointer',
                            fontSize: 12,
                            textDecoration: 'underline',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 12,
            }}>
                {rootObjects.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                        No objects in scene
                    </div>
                ) : (
                    rootObjects.map(obj => (
                        <SceneGraphNode
                            key={obj.id}
                            object={obj}
                            objectMap={objectMap}
                            level={0}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default SceneGraph;
