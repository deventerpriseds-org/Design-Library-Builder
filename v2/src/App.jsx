import React, { useEffect } from 'react'
import { AppProvider, useApp, useRoute } from './state.jsx'
import { Shell } from './shell.jsx'
import { handleGoogleCallback, initMicrosoft } from './auth.js'
import Upload from './screens/Upload.jsx'
import Extract from './screens/Extract.jsx'
import Review from './screens/Review.jsx'
import Export from './screens/Export.jsx'
import Showcase from './screens/Showcase.jsx'
import FigmaPush from './screens/FigmaPush.jsx'
import Libraries from './screens/Libraries.jsx'

function Router() {
  const { dispatch } = useApp()
  const { path } = useRoute()

  useEffect(() => {
    // Initialize MSAL on startup so popup windows can hand off auth tokens
    initMicrosoft().then((user) => {
      if (user) dispatch({ type: 'SET_USER', user })
    }).catch(console.error)
    // Handle Google OAuth callback — runs once on load
    handleGoogleCallback().then((user) => {
      if (user) dispatch({ type: 'SET_USER', user })
    }).catch(console.error)
  }, [])

  const screen = path.replace(/^\//, '').split('/')[0] || 'upload'

  return (
    <Shell>
      {screen === 'upload' && <Upload />}
      {screen === 'extract' && <Extract />}
      {screen === 'review' && <Review />}
      {screen === 'export' && <Export />}
      {screen === 'figma-push' && <FigmaPush />}
      {screen === 'showcase' && <Showcase />}
      {screen === 'libraries' && <Libraries />}
    </Shell>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
