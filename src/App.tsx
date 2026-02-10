import './App.css'

import { KeyboardControls } from '@react-three/drei'

import Header from '@/header/Header'
import Playground from '@/playground/Playground'
import Popups from '@/popups/Popups'

function App() {
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
    </KeyboardControls>
  )
}

export default App
