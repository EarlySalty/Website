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

export default function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
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
      </Route>
    </Routes>
  )
}