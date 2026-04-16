import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import YeastsPage from './pages/YeastsPage'
import RecipesPage from './pages/RecipesPage'
import CalculatorsPage from './pages/CalculatorsPage'
import ExplorePage from './pages/ExplorePage'
import ProfilePage from './pages/ProfilePage'
import ShareProjectPage from './pages/ShareProjectPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--warm-white)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🫧</div>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/share/:id" element={<ShareProjectPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="yeasts" element={<YeastsPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="calculators" element={<CalculatorsPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/:username" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}
