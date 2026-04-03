import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/contexts/AuthContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import PrivateRoute from '@/components/layout/PrivateRoute'
import RoleRoute from '@/components/layout/RoleRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import States from '@/pages/States'
import StateDetail from '@/pages/StateDetail'
import Trades from '@/pages/Trades'
import Clients from '@/pages/Clients'
import ClientDetail from '@/pages/ClientDetail'
import ClientForm from '@/pages/ClientForm'
import Schedule from '@/pages/Schedule'
import Glossary from '@/pages/Glossary'
import Onboarding from '@/pages/Onboarding'
import JoinWorkspace from '@/pages/JoinWorkspace'
import WorkspaceSettings from '@/pages/workspace/WorkspaceSettings'
import WorkspaceMembers from '@/pages/workspace/WorkspaceMembers'
import WorkspaceSubteams from '@/pages/workspace/WorkspaceSubteams'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="pyxis-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
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
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
