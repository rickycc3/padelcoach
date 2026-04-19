import { Navigate, Route, Routes } from 'react-router-dom'
import MatchSetupScreen from './screens/MatchSetupScreen'
import MatchSetupPreview from './screens/MatchSetupPreview'
import LiveMatchScreen from './screens/LiveMatchScreen'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchSetupScreen />} />
      <Route path="/partido-en-vivo/:sessionId" element={<LiveMatchScreen />} />
      <Route path="/preview/pantalla-1" element={<MatchSetupPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
