import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/contexts/AuthContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import PrivateRoute from '@/components/layout/PrivateRoute'
import RoleRoute from '@/components/layout/RoleRoute'
import AppLayout from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/sonner'
import UpdateBanner from '@/components/layout/UpdateBanner'
import PageLoader from '@/components/layout/PageLoader'

// Una página por chunk (spec 10): cada ruta descarga su código al visitarla.
const Login = lazy(() => import('@/pages/Login'))
const Home = lazy(() => import('@/pages/Home'))
const States = lazy(() => import('@/pages/States'))
const StateDetail = lazy(() => import('@/pages/StateDetail'))
const Trades = lazy(() => import('@/pages/Trades'))
const Clients = lazy(() => import('@/pages/Clients'))
const ClientDetail = lazy(() => import('@/pages/ClientDetail'))
const ClientForm = lazy(() => import('@/pages/ClientForm'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const Reports = lazy(() => import('@/pages/Reports'))
const Glossary = lazy(() => import('@/pages/Glossary'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const JoinWorkspace = lazy(() => import('@/pages/JoinWorkspace'))
const WorkspaceSettings = lazy(() => import('@/pages/workspace/WorkspaceSettings'))
const WorkspaceMembers = lazy(() => import('@/pages/workspace/WorkspaceMembers'))
const WorkspaceSubteams = lazy(() => import('@/pages/workspace/WorkspaceSubteams'))

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="pyxis-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader fullScreen />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/join"
                  element={
                    <PrivateRoute>
                      <WorkspaceProvider>
                        <JoinWorkspace />
                      </WorkspaceProvider>
                    </PrivateRoute>
                  }
                />
                <Route
                  element={
                    <PrivateRoute>
                      <WorkspaceProvider>
                        <AppLayout />
                      </WorkspaceProvider>
                    </PrivateRoute>
                  }
                >
                  <Route index element={<Home />} />
                  <Route path="estados" element={<States />} />
                  <Route path="estados/:abbreviation" element={<StateDetail />} />
                  <Route path="oficios" element={<Trades />} />
                  <Route path="clientes" element={<Clients />} />
                  <Route path="clientes/nuevo" element={<ClientForm />} />
                  <Route path="clientes/:id" element={<ClientDetail />} />
                  <Route path="clientes/:id/editar" element={<ClientForm />} />
                  <Route path="agenda" element={<Schedule />} />
                  <Route path="reportes" element={<Reports />} />
                  <Route path="glosario" element={<Glossary />} />

                  {/* Workspace management — owner only */}
                  <Route
                    path="workspace"
                    element={
                      <RoleRoute allowedRoles={['owner']}>
                        <WorkspaceSettings />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="workspace/miembros"
                    element={
                      <RoleRoute allowedRoles={['owner']}>
                        <WorkspaceMembers />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="workspace/subteams"
                    element={
                      <RoleRoute allowedRoles={['owner']}>
                        <WorkspaceSubteams />
                      </RoleRoute>
                    }
                  />
                </Route>

                {/* Onboarding — separate from AppLayout (no sidebar) */}
                <Route
                  path="/onboarding"
                  element={
                    <PrivateRoute>
                      <WorkspaceProvider>
                        <Onboarding />
                      </WorkspaceProvider>
                    </PrivateRoute>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
          <UpdateBanner />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
