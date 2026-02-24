import { useState, useEffect } from 'react'
import './App.css'

import { KeyboardControls } from '@react-three/drei'

import Header from '@/header/Header'
import Playground from '@/playground/Playground'
import Popups from '@/popups/Popups'
import UserNameDialog from '@/components/UserNameDialog'
import { awarenessStore } from '@/stores/useAwarenessStore'
import { sceneStore } from '@/playground/scene/hooks/useYjsSceneStore'

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
        { name: 'reset', keys: ['r', 'R']},
        { name: 'xcamera', keys: ['x']},
        { name: 'ycamera', keys: ['y']},
        { name: 'zcamera', keys: ['z']},  
        { name: 'toggleaxes', keys: ['b']},
        { name: 'toggleorbit', keys: ['n']},
        // { name: 'addbox', keys: ['Control', 'i']}, // Verwijderd, nu handmatig
        { name: 'viewsettings', keys: ['V']},
      ]}>
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
