import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { GrantProvider } from '@/features/auth/GrantContext'
import AuthGuard from '@/features/auth/AuthGuard'
import GrantGuard from '@/features/auth/GrantGuard'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Portfolios from '@/pages/Portfolios'
import Portfolio from '@/pages/Portfolio'
import Scenarios from '@/pages/Scenarios'
import ScenarioDetail from '@/pages/ScenarioDetail'
import ScenarioCompare from '@/pages/ScenarioCompare'
import Goals from '@/pages/Goals'
import Settings from '@/pages/Settings'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GrantProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes — all share AppLayout */}
            <Route
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route path="/" element={
                <GrantGuard page="dashboard"><Dashboard /></GrantGuard>
              } />
              <Route path="/portfolios" element={
                <GrantGuard page="portfolios"><Portfolios /></GrantGuard>
              } />
              <Route path="/portfolios/:id" element={
                <GrantGuard page="portfolios"><Portfolio /></GrantGuard>
              } />
              <Route path="/scenarios" element={
                <GrantGuard page="scenarios"><Scenarios /></GrantGuard>
              } />
              <Route path="/scenarios/compare" element={
                <GrantGuard page="scenarios"><ScenarioCompare /></GrantGuard>
              } />
              <Route path="/scenarios/:id" element={
                <GrantGuard page="scenarios"><ScenarioDetail /></GrantGuard>
              } />
              <Route path="/goals" element={
                <GrantGuard page="goals"><Goals /></GrantGuard>
              } />
              {/* Settings — always accessible to all authenticated users */}
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GrantProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
