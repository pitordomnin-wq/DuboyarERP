import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { canSeePage, homePath, type PageKey } from '@/lib/nav'
import { LoginPage } from '@/pages/LoginPage'
import { AppShell } from '@/pages/AppShell'
import { TasksPage } from '@/pages/TasksPage'
import { CounterpartiesPage } from '@/pages/CounterpartiesPage'
import { CounterpartyEditPage, CounterpartyNewPage } from '@/pages/CounterpartyEditPage'
import { SalesPage } from '@/pages/SalesPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { WarehousePage } from '@/pages/WarehousePage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { ProductionPage } from '@/pages/ProductionPage'
import { MailPage } from '@/pages/MailPage'
import { AdminPage } from '@/pages/AdminPage'
import { HomePage } from '@/pages/HomePage'

function PageGuard({ page, children }: { page: PageKey; children: ReactNode }) {
  const { user } = useAuth()
  if (!canSeePage(user, page)) {
    return <Navigate to={homePath(user)} replace />
  }
  return children
}

export default function App() {
  const { user, ready } = useAuth()

  if (!ready) {
    return <div className="min-h-dvh bg-background" />
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath(user)} replace /> : <LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/tasks"
          element={
            <PageGuard page="tasks">
              <TasksPage />
            </PageGuard>
          }
        />
        <Route
          path="/mail"
          element={
            <PageGuard page="mail">
              <MailPage />
            </PageGuard>
          }
        />
        <Route
          path="/sales"
          element={
            <PageGuard page="sales">
              <SalesPage />
            </PageGuard>
          }
        />
        <Route
          path="/warehouse"
          element={
            <PageGuard page="warehouse">
              <WarehousePage />
            </PageGuard>
          }
        />
        <Route
          path="/production"
          element={
            <PageGuard page="production">
              <ProductionPage />
            </PageGuard>
          }
        />
        <Route
          path="/products"
          element={
            <PageGuard page="products">
              <ProductsPage />
            </PageGuard>
          }
        />
        <Route
          path="/purchases"
          element={
            <PageGuard page="purchases">
              <PurchasesPage />
            </PageGuard>
          }
        />
        <Route
          path="/counterparties"
          element={
            <PageGuard page="counterparties">
              <CounterpartiesPage />
            </PageGuard>
          }
        />
        <Route
          path="/counterparties/new"
          element={
            <PageGuard page="counterparties">
              <CounterpartyNewPage />
            </PageGuard>
          }
        />
        <Route
          path="/counterparties/:id"
          element={
            <PageGuard page="counterparties">
              <CounterpartyEditPage />
            </PageGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <PageGuard page="admin">
              <AdminPage />
            </PageGuard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={user ? homePath(user) : '/login'} replace />} />
    </Routes>
  )
}
