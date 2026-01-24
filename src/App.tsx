import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { AppLayout } from './components/AppLayout';
import MatchesListPage from './pages/MatchesListPage';
import LiveMatchView from './pages/LiveMatchView';
import PlayerProfile from './pages/PlayerProfile';
import AdminDashboard from './pages/AdminDashboard';
import { CircularProgress, Box } from '@mui/material';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated() ? <Navigate to="/matches" replace /> : <LoginForm />} />
      <Route path="/register" element={isAuthenticated() ? <Navigate to="/matches" replace /> : <RegisterForm />} />
      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <MatchesListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches/:matchId"
        element={
          <ProtectedRoute>
            <LiveMatchView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/players/:playerId"
        element={
          <ProtectedRoute>
            <PlayerProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={isAuthenticated() ? "/matches" : "/register"} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated() ? "/matches" : "/register"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
