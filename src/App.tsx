import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import Header from '@/header/Header'
import Playground from '@/playground/Playground'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className='flex flex-col h-screen'>
        <Header />

        <div className='flex-grow'>
          <Playground />
        </div>
      </div>
    </>
  )
}

export default App
