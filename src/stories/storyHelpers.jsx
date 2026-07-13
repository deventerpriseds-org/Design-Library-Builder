import React, { useEffect } from 'react'
import { AppProvider, useApp } from '../state.jsx'

export function WithState({ initialState, children }) {
  return (
    <AppProvider>
      <StateSeeder initialState={initialState}>{children}</StateSeeder>
    </AppProvider>
  )
}

function StateSeeder({ initialState, children }) {
  const { dispatch } = useApp()
  useEffect(() => {
    if (!initialState) return
    if (initialState.result) dispatch({ type: 'SET_RESULT', result: initialState.result })
    if (initialState.projectName) dispatch({ type: 'SET_NAME', name: initialState.projectName })
    if (initialState.user) dispatch({ type: 'SET_USER', user: initialState.user })
  }, [])
  return children
}
