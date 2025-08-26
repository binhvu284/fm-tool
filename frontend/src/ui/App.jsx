import React from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import WatermarkPage from './pages/WatermarkPage.jsx';
import SignaturePage from './pages/SignaturePage.jsx';
import SaaSLayout from './components/SaaSLayout.jsx';

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
            <SaaSLayout pageTitle="Files">
              <Dashboard />
            </SaaSLayout>
          }
        />
        <Route
          path="/watermark"
          element={
            <SaaSLayout pageTitle="Watermark">
              <WatermarkPage />
            </SaaSLayout>
          }
        />
        <Route
          path="/signature"
          element={
            <SaaSLayout pageTitle="Signature">
              <SignaturePage />
            </SaaSLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
