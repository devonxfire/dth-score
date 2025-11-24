import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GlobalPopups from './GlobalPopups'
import { SimpleToastContainer } from './simpleToast'

// Prevent programmatic scrollIntoView from forcing viewport jumps on touch
// devices / narrow viewports. Some components call `el.scrollIntoView()` on
// input focus which causes the page to snap/jump on iOS/Android. We override
// Element.prototype.scrollIntoView to be a no-op in that environment. To opt
// back in for a specific element, set the data attribute
// `data-force-scroll="1"` on the element and the original behavior will run.
try {
  const _origScrollIntoView = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function scrollIntoViewGuard(arg) {
    try {
      const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0))
      const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 768
      // If not a touch narrow viewport, call original
      if (!isTouch || !isNarrow) return _origScrollIntoView.call(this, arg)
      // If explicit opt-in is present, allow the scroll
      if (this && this.dataset && this.dataset.forceScroll === '1') return _origScrollIntoView.call(this, arg)
      // Otherwise skip the programmatic scroll to avoid bounce/jump on mobile
      return undefined
    } catch (e) {
      // If anything goes wrong, fall back to original behavior
      return _origScrollIntoView.call(this, arg)
    }
  }
} catch (e) {
  // Some environments may not allow prototype assignment; ignore silently
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <GlobalPopups />
      <SimpleToastContainer />
    </>
  </StrictMode>,
)
