import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GlobalPopups from './GlobalPopups'
import { SimpleToastContainer } from './simpleToast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <GlobalPopups />
      <SimpleToastContainer />
    </>
  </StrictMode>,
)
