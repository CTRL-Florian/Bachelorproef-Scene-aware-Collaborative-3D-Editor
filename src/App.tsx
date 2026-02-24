import { useState, useEffect } from 'react'
import './App.css'

import { KeyboardControls } from '@react-three/drei'

import Header from '@/header/Header'
import Playground from '@/playground/Playground'
import Popups from '@/popups/Popups'
import UserNameDialog from '@/components/UserNameDialog'
import { awarenessStore } from '@/stores/useAwarenessStore'
import { sceneStore } from '@/playground/scene/hooks/useYjsSceneStore'
import { useUndoRedoKeyboard } from '@/commands/useUndoRedoKeyboard'

// Component dat de keyboard shortcuts registreert
function UndoRedoHandler() {
  useUndoRedoKeyboard();
  return null;
}

function App() {
  // Always show name dialog on load - each tab/session is a new user
  const [showNameDialog, setShowNameDialog] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize awareness store with the provider
    const provider = sceneStore.getProvider();
    awarenessStore.initialize(provider);
    setIsReady(true);
  }, []);

  const handleNameComplete = () => {
    setShowNameDialog(false);
  };

  return (
    <KeyboardControls map={[
        { name: 'toggleaxes', keys: ['b']},
        { name: 'toggleorbit', keys: ['n']},
        { name: 'viewsettings', keys: ['V']},
      ]}>
      {/* Undo/Redo keyboard handler */}
      <UndoRedoHandler />
      
      <div className='flex flex-col h-screen'>
        <Header />

        <div className='flex-grow'>
          <Playground />
          <Popups />
        </div>
      </div>

      {isReady && (
        <UserNameDialog 
          open={showNameDialog} 
          onComplete={handleNameComplete} 
        />
      )}
    </KeyboardControls>
  )
}

export default App
