import { Navigate, Route, Routes } from 'react-router-dom'
import LiveMatchScreen from './screens/LiveMatchScreen'
import MatchSetupPreview from './screens/MatchSetupPreview'
import MatchSetupScreen from './screens/MatchSetupScreen'
import MatchSummaryScreen from './screens/MatchSummaryScreen'
import MatchTimelineScreen from './screens/MatchTimelineScreen'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchSetupScreen />} />
      <Route path="/partido-en-vivo/:sessionId" element={<LiveMatchScreen />} />
      <Route path="/resumen/:sessionId" element={<MatchSummaryScreen />} />
      <Route path="/sesion/:sessionId/timeline" element={<MatchTimelineScreen />} />
      <Route path="/preview/pantalla-1" element={<MatchSetupPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
