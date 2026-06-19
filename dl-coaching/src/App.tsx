import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CoachesPage from './pages/CoachesPage'
import CoachDetailPage from './pages/CoachDetailPage'
import CoachDashboardPage from './pages/CoachDashboardPage'
import CoachOverviewPage from './pages/CoachOverviewPage'
import CoacheeDetailPage from './pages/CoacheeDetailPage'
import CoachingRequestPage from './pages/CoachingRequestPage'
import MyCoachingPage from './pages/MyCoachingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<CoachesPage />} />
        <Route path="anfrage" element={<CoachingRequestPage />} />
        <Route path="coaches/:id" element={<CoachDetailPage />} />
        <Route path="dashboard" element={<CoachDashboardPage />} />
        <Route path="overview" element={<CoachOverviewPage />} />
        <Route path="coachees/:id" element={<CoacheeDetailPage />} />
        <Route path="me" element={<MyCoachingPage />} />
      </Route>
    </Routes>
  )
}
