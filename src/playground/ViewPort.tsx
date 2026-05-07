import { Canvas } from '@react-three/fiber';

import SceneSettings from '@/playground/scene/SceneSettings';
import SceneAxes from '@/playground/scene/SceneAxes';
import SceneCamera from '@/playground/scene/SceneCamera';
import SceneContent from '@/playground/scene/SceneContent';
import SceneGrid from '@/playground/scene/SceneGrid';
import { useLinkModeStore } from '@/playground/hooks/useLinkModeStore';
import { activeVariant } from '@/collaboration/factory';

const VARIANT_LABELS: Record<string, string> = {
  A: 'A — Object LWW',
  B: 'B — Property CRDT',
  C: 'C — Delta log',
  D: 'D — OT server',
};

const ViewPort: React.FC = () => {
    const { isLinking, cancelLinking } = useLinkModeStore();
    const variant = activeVariant();

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Canvas>
                <SceneSettings />
                <SceneCamera />
                <SceneGrid />
                <SceneAxes />
                <SceneContent />
            </Canvas>

            {/* Variant badge — bottom-right corner */}
            <div style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                fontSize: 11,
                fontFamily: 'monospace',
                padding: '3px 8px',
                borderRadius: 4,
                pointerEvents: 'none',
                zIndex: 5,
                letterSpacing: '0.02em',
            }}>
                Variant {VARIANT_LABELS[variant] ?? variant}
            </div>

            {/* Link mode overlay: rode rand en bericht */}
            {isLinking && (
                <>
                    {/* Rode rand overlay */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '4px solid #ef4444',
                        borderRadius: 4,
                        pointerEvents: 'none',
                        zIndex: 10,
                    }} />

                    {/* Bericht boven het canvas */}
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        right: 8,
                        padding: '10px 16px',
                        background: 'rgba(239, 68, 68, 0.95)',
                        color: '#fff',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        zIndex: 11,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                            🔗 Link Mode: Click on a box to set it as parent
                        </span>
                        <button
                            onClick={cancelLinking}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.4)',
                                padding: '4px 12px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontWeight: 500,
                                color: '#fff',
                                fontSize: 13,
                            }}
                        >
                            Cancel (Esc)
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default ViewPort;