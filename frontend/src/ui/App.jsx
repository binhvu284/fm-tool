import React from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import WatermarkPage from './pages/WatermarkPage.jsx';
import SignaturePage from './pages/SignaturePage.jsx';
import SaaSLayout from './components/SaaSLayout.jsx';
import AdminFilesPage from './pages/AdminFilesPage.jsx';
import AdminAgentsPage from './pages/AdminAgentsPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';

const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#5B7FFF' }, secondary: { main: '#5BE7C4' } },
  shape: { borderRadius: 12 }
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <SaaSLayout pageTitle="Files">
                <Dashboard />
              </SaaSLayout>
            </RequireAuth>
          }
        />
        {/** Legacy redirect */}
        <Route path="/admin" element={<Navigate to="/admin-files" replace />} />
        <Route
          path="/admin-files"
          element={
            <RequireAuth role="admin">
              <SaaSLayout pageTitle="File Management" fullWidthContent>
                <AdminFilesPage />
              </SaaSLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin-agents"
          element={
            <RequireAuth role="admin">
              <SaaSLayout pageTitle="Agent" fullWidthContent>
                <AdminAgentsPage />
              </SaaSLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/watermark"
          element={
            <RequireAuth>
              <SaaSLayout pageTitle="Watermark">
                <WatermarkPage />
              </SaaSLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/signature"
          element={
            <RequireAuth>
              <SaaSLayout pageTitle="Signature">
                <SignaturePage />
              </SaaSLayout>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
