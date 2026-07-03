import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav'
import LoadingScreen from './components/LoadingScreen'
import { AppDataProvider } from './context/AppDataContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PlayerCardProvider } from './components/PlayerCard/PlayerCardContext'
import PlayerCardPortal from './components/PlayerCard/PlayerCardPortal'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import ScoreboardPage from './pages/ScoreboardPage'
import StandingsPage from './pages/StandingsPage'
import TeamsPage from './pages/TeamsPage'
import PlayersPage from './pages/PlayersPage'
import PlayerStatsPage from './pages/PlayerStatsPage'
import PlayerPage from './pages/PlayerPage'
import TeamPage from './pages/TeamPage'
import SettingsPage from './pages/SettingsPage'
import FreeAgentsPage from './pages/FreeAgentsPage'
import TransactionsPage from './pages/TransactionsPage'
import SalaryCapPage from './pages/SalaryCapPage'
import DraftPage from './pages/DraftPage'
import RulesPage from './pages/RulesPage'
import AdminPage from './pages/AdminPage'
import FABidPage from './pages/FABidPage'
import AdminRosterPage from './pages/AdminRosterPage'
import AdminBulkEditPage from './pages/AdminBulkEditPage'
import AdminManagersPage from './pages/AdminManagersPage'
import TradeMachinePage from './pages/TradeMachinePage'
import InboxPage from './pages/InboxPage'
import CalendarPage from './pages/CalendarPage'
import TradeBlockPage from './pages/TradeBlockPage'
import WatchlistPage from './pages/WatchlistPage'
import CapSheetPage from './pages/CapSheetPage'
import RookieDraft  from './pages/draft/RookieDraft'
import RFADraft     from './pages/draft/RFADraft'
import UFADraft     from './pages/draft/UFADraft'
import AdminRFAPage from './pages/AdminRFAPage'
import AdminUFAPage from './pages/AdminUFAPage'
import MatchupPage       from './pages/MatchupPage'
import AdminHealthPage  from './pages/AdminHealthPage'
import MasterSchedulePage from './pages/MasterSchedulePage'
import DraftCentralPage from './pages/DraftCentralPage'
import DraftBoardPage   from './pages/DraftBoardPage'

function DraftWrapper({ component: Component }) {
  const { manager, isAdmin } = useAuth()
  return <Component currentTeam={manager?.team_abbrev || 'NH'} isCommissioner={isAdmin || false} />
}

function AuthenticatedApp() {
  const { user, loading } = useAuth()
  const [loadingDone, setLoadingDone] = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [stepLabel,   setStepLabel]   = useState('')

  const handleProgress = useCallback((pct, label) => {
    setProgress(pct)
    setStepLabel(label)
  }, [])

  if (loading) return null
  if (!user) return <LoginPage />

  return (
    <PlayerCardProvider>
      {!loadingDone && (
        <LoadingScreen
          progress={progress}
          stepLabel={stepLabel}
          onComplete={() => setLoadingDone(true)}
        />
      )}
      <AppDataProvider onProgress={handleProgress}>
        <div style={{ minHeight:'100vh', background:'var(--bg0)', opacity: loadingDone ? 1 : 0, transition:'opacity 0.3s ease' }}>
          <TopNav />
          <Routes>
            <Route path="/"              element={<DashboardPage />} />
            <Route path="/home"          element={<HomePage />} />
            <Route path="/scoreboard"    element={<ScoreboardPage />} />
            <Route path="/teams"         element={<TeamsPage />} />
            <Route path="/standings"     element={<StandingsPage />} />
            <Route path="/players"       element={<PlayersPage />} />
            <Route path="/player-stats"  element={<PlayerStatsPage />} />
            <Route path="/player/:id"    element={<PlayerPage />} />
            <Route path="/team/:abbrev"  element={<TeamPage />} />
            <Route path="/free-agents"   element={<FreeAgentsPage />} />
            <Route path="/transactions"  element={<TransactionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/salary-cap"    element={<SalaryCapPage />} />
            <Route path="/draft"       element={<DraftCentralPage />} />
            <Route path="/draft/board" element={<DraftBoardPage />} />
            <Route path="/draft/rookie"  element={<DraftWrapper component={RookieDraft} />} />
            <Route path="/draft/rfa"     element={<DraftWrapper component={RFADraft} />} />
            <Route path="/draft/ufa"     element={<DraftWrapper component={UFADraft} />} />
            <Route path="/rules"         element={<RulesPage />} />
            <Route path="/fa-bid"        element={<FABidPage />} />
            <Route path="/trade"         element={<TradeMachinePage />} />
            <Route path="/inbox"         element={<InboxPage />} />
            <Route path="/calendar"      element={<CalendarPage />} />
            <Route path="/trade-block"   element={<TradeBlockPage />} />
            <Route path="/watchlist"     element={<WatchlistPage />} />
            <Route path="/team/:abbrev/cap" element={<CapSheetPage />} />
            <Route path="/matchup/:matchupId" element={<MatchupPage />} />
            <Route path="/admin"              element={<AdminPage />} />
            <Route path="/admin/roster"       element={<AdminRosterPage />} />
            <Route path="/admin/bulk-edit"    element={<AdminBulkEditPage />} />
            <Route path="/admin/managers"     element={<AdminManagersPage />} />
            <Route path="/admin/rfa"          element={<AdminRFAPage />} />
            <Route path="/schedule" element={<MasterSchedulePage />} />
            <Route path="/admin/ufa"          element={<AdminUFAPage />} />
            <Route path="/admin/health"        element={<AdminHealthPage />} />
          </Routes>
        </div>
      </AppDataProvider>
      <PlayerCardPortal />
    </PlayerCardProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}
