import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GlobalPopups from './GlobalPopups'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <GlobalPopups />
    </>
  </StrictMode>,
)
