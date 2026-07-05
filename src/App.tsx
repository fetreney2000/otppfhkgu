import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { ReportsPage } from './pages/ReportsPage';
import { UnavailabilityPage } from './pages/UnavailabilityPage';
import { MySchedulePage } from './pages/MySchedulePage';
import { ChartsPage } from './pages/ChartsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { HelpPage } from './pages/HelpPage';
import { SolverMetricsPage } from './pages/SolverMetricsPage';
import { AdminUnavailabilityPage } from './pages/AdminUnavailabilityPage';

const theme = createTheme({
  primaryColor: 'blue',
  colors: {
    brand: ['#edf4fc', '#d4e4f7', '#a8c8ee', '#7bacdf', '#5693d0', '#3b7dc0', '#2d6aad', '#245a97', '#1d4d80', '#103860'],
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
  spacing: { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' },
});

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, role } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/my-schedule" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const { setOnline } = useAppStore.getState();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <ModalsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/my-schedule" replace />} />
              <Route path="admin" element={
                <ProtectedRoute roles={['admin', 'superadmin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="employees" element={
                <ProtectedRoute roles={['admin', 'superadmin']}>
                  <EmployeeManagement />
                </ProtectedRoute>
              } />
              <Route path="reports" element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              } />
              <Route path="unavailability" element={
                <ProtectedRoute>
                  <UnavailabilityPage />
                </ProtectedRoute>
              } />
              <Route path="my-schedule" element={
                <ProtectedRoute>
                  <MySchedulePage />
                </ProtectedRoute>
              } />
              <Route path="charts" element={
                <ProtectedRoute>
                  <ChartsPage />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute roles={['admin', 'superadmin']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="help" element={
                <ProtectedRoute>
                  <HelpPage />
                </ProtectedRoute>
              } />
              <Route path="solver-metrics" element={
                <ProtectedRoute roles={['superadmin']}>
                  <SolverMetricsPage />
                </ProtectedRoute>
              } />
              <Route path="admin-unavailability" element={
                <ProtectedRoute roles={['admin', 'superadmin']}>
                  <AdminUnavailabilityPage />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  );
}

export default App;