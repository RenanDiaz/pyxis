import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/contexts/AuthContext'
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
import TeamMetrics from '@/pages/team/TeamMetrics'
import TeamClients from '@/pages/team/TeamClients'
import TeamSchedule from '@/pages/team/TeamSchedule'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminTeams from '@/pages/admin/AdminTeams'
import AdminClients from '@/pages/admin/AdminClients'
import AdminSchedule from '@/pages/admin/AdminSchedule'
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
                element={
                  <PrivateRoute>
                    <AppLayout />
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

                {/* Supervisor routes */}
                <Route
                  path="equipo/metricas"
                  element={
                    <RoleRoute allowedRoles={['supervisor', 'admin']}>
                      <TeamMetrics />
                    </RoleRoute>
                  }
                />
                <Route
                  path="equipo/clientes"
                  element={
                    <RoleRoute allowedRoles={['supervisor', 'admin']}>
                      <TeamClients />
                    </RoleRoute>
                  }
                />
                <Route
                  path="equipo/agenda"
                  element={
                    <RoleRoute allowedRoles={['supervisor', 'admin']}>
                      <TeamSchedule />
                    </RoleRoute>
                  }
                />

                {/* Admin routes */}
                <Route
                  path="admin/usuarios"
                  element={
                    <RoleRoute allowedRoles={['admin']}>
                      <AdminUsers />
                    </RoleRoute>
                  }
                />
                <Route
                  path="admin/equipos"
                  element={
                    <RoleRoute allowedRoles={['admin']}>
                      <AdminTeams />
                    </RoleRoute>
                  }
                />
                <Route
                  path="admin/clientes"
                  element={
                    <RoleRoute allowedRoles={['admin']}>
                      <AdminClients />
                    </RoleRoute>
                  }
                />
                <Route
                  path="admin/agenda"
                  element={
                    <RoleRoute allowedRoles={['admin']}>
                      <AdminSchedule />
                    </RoleRoute>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
