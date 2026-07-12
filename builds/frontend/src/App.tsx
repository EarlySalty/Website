import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import HeroesPage from './pages/HeroesPage'
import HeroDetailPage from './pages/HeroDetailPage'
import TierListsPage from './pages/TierListsPage'
import TierListEditPage from './pages/TierListEditPage'
import PatchNotesPage from './pages/PatchNotesPage'
import HistoryPage from './pages/HistoryPage'
import FeedbackPage from './pages/FeedbackPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import CoachesPage from './pages/CoachesPage'
import CoachDetailPage from './pages/CoachDetailPage'
import CoachDashboardPage from './pages/CoachDashboardPage'
import CoachOverviewPage from './pages/CoachOverviewPage'
import CoacheeDetailPage from './pages/CoacheeDetailPage'
import MyCoachingPage from './pages/MyCoachingPage'
import VideosPage from './pages/VideosPage'
import DdlShell from './components/DdlShell'

const DDL_SHELL = import.meta.env.VITE_SHELL === 'ddl'

const videoRoutes = (
  <>
    <Route path="videos" element={<VideosPage />} />
    <Route path="videos/playlists/:id" element={<VideosPage view="playlist" />} />
    <Route path="videos/creators/:id" element={<VideosPage view="creator" />} />
  </>
)

export default function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      {DDL_SHELL && (
        <Route path="/" element={<DdlShell />}>
          {videoRoutes}
        </Route>
      )}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="heroes" element={<HeroesPage />} />
        <Route path="heroes/:name" element={<HeroDetailPage />} />
        <Route path="tierlists" element={<TierListsPage />} />
        <Route path="tierlists/my" element={<TierListsPage />} />
        <Route path="tierlists/:id/edit" element={<TierListEditPage />} />
        <Route path="patchnotes" element={<PatchNotesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/heroes" element={<AdminPage />} />
        <Route path="admin/patches" element={<AdminPage />} />
        <Route path="admin/reports" element={<AdminPage />} />
        <Route path="admin/votes" element={<AdminPage />} />
        <Route path="admin/users" element={<AdminPage />} />
        <Route path="coaching" element={<CoachesPage />} />
        <Route path="coaching/coaches" element={<CoachesPage />} />
        <Route path="coaching/coaches/:id" element={<CoachDetailPage />} />
        <Route path="coaching/dashboard" element={<CoachDashboardPage />} />
        <Route path="coaching/overview" element={<CoachOverviewPage />} />
        <Route path="coaching/coachees/:id" element={<CoacheeDetailPage />} />
        <Route path="coaching/me" element={<MyCoachingPage />} />
        {!DDL_SHELL && videoRoutes}
      </Route>
    </Routes>
  )
}
