import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from './hooks/useAuth';
import { I18nProvider } from './lib/i18n';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedAccess } from './components/shared/ProtectedAccess';
import { Login } from './components/auth/Login';
import { LandingPage } from './components/LandingPage';
import { VerifyEmail } from './components/auth/VerifyEmail';
import { ReviewsPage } from './components/ReviewsPage';

// Admin Components
import { Dashboard } from './components/admin/Dashboard/Dashboard';
import { BikeManagement } from './components/admin/Bikes/BikeManagement';
import { BikeDetails } from './components/admin/Bikes/BikeDetails';
import { BikeTripHistory } from './components/admin/Bikes/BikeTripHistory';
import { BikeMaintenanceHistory } from './components/admin/Bikes/BikeMaintenanceHistory';
import { BikeActionManagement } from './components/admin/Bikes/BikeActionManagement';
import { BikeMap } from './components/admin/Bikes/BikeMap';
import { UserManagement } from './components/admin/Users/UserManagement';
import { UserDetails } from './components/admin/Users/UserDetails';
import { FinancialDashboard } from './components/admin/Financial/FinancialDashboard';
import { IncidentManagement } from './components/admin/Incidents/IncidentManagement';
import { ReviewManagement } from './components/admin/Review/ReviewManagement';
import { WalletManagement } from './components/admin/Wallet/WalletManagement';
import { ReservationManagement } from './components/admin/Reservations/ReservationManagement';
import { CompanySettings } from './components/admin/Settings/CompanySettings';
import { SubscriptionPackageManager } from './components/admin/Settings/SubscriptionPackageManager';
import { EmployeeManagement } from './components/admin/Employees/EmployeeManagement';
import { RolesManagement } from './components/admin/Employees/RolesManagement';
import { ActivityLogs } from './components/admin/Logs/ActivityLogs';
import { AdminProfile } from './components/admin/Profile/AdminProfile';
import { AdminNotifications } from './components/admin/Profile/AdminNotifications';
import { AdminChat } from './components/admin/Profile/AdminChat';
import { SecurityMonitoringProvider } from './components/admin/Security/SecurityMonitoringProvider';

import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <I18nProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedAccess mode="route" requiredRole={['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']}><AdminLayout /></ProtectedAccess>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              
              {/* Dashboard */}
              <Route path="dashboard" element={<ProtectedAccess mode="route" resource="admin" action="read"><Dashboard /></ProtectedAccess>} />
              
              {/* Bike Management */}
              <Route path="bikes" element={<ProtectedAccess mode="route" resource="bikes" action="read"><BikeManagement /></ProtectedAccess>} />
              <Route path="bikes/actions" element={<ProtectedAccess mode="route" resource="bikes" action="manage_actions"><BikeActionManagement /></ProtectedAccess>} />
              <Route path="bikes/:id" element={<ProtectedAccess mode="route" resource="bikes" action="read"><BikeDetails /></ProtectedAccess>} />
              <Route path="bikes/:id/trips" element={<ProtectedAccess mode="route" resource="bikes" action="view_trips"><BikeTripHistory /></ProtectedAccess>} />
              <Route path="bikes/:id/maintenance" element={<ProtectedAccess mode="route" resource="bikes" action="view_maintenance"><BikeMaintenanceHistory /></ProtectedAccess>} />
              <Route path="bikes/:id/map" element={<ProtectedAccess mode="route" resource="bikes" action="view_map"><BikeMap /></ProtectedAccess>} />
              
              {/* User Management */}
              <Route path="users" element={<ProtectedAccess mode="route" resource="users" action="read"><UserManagement /></ProtectedAccess>} />
              <Route path="users/:id" element={<ProtectedAccess mode="route" resource="users" action="read"><UserDetails /></ProtectedAccess>} />

              {/* Reservations */}
              <Route path="reservations" element={<ProtectedAccess mode="route" resource="reservations" action="read"><ReservationManagement /></ProtectedAccess>} />
              
              {/* Financial */}
              <Route path="financial" element={<ProtectedAccess mode="route" resource="wallet" action="read"><FinancialDashboard /></ProtectedAccess>} />
              
              {/* Incidents */}
              <Route path="incidents" element={<ProtectedAccess mode="route" resource="incidents" action="read"><IncidentManagement /></ProtectedAccess>} />

              {/* Review */}
              <Route path="reviews" element={<ProtectedAccess mode="route" resource="reviews" action="read"><ReviewManagement /></ProtectedAccess>} />
              
              {/* Settings */}
              <Route path="wallet" element={<ProtectedAccess mode="route" resource="wallet" action="read"><WalletManagement /></ProtectedAccess>} />
              <Route path="pricing" element={<ProtectedAccess mode="route" resource="pricing" action="read"><SubscriptionPackageManager /></ProtectedAccess>} />
              <Route path="settings" element={<ProtectedAccess mode="route" resource="settings" action="read"><CompanySettings /></ProtectedAccess>} />
              
              
              {/* Employee Management */}
              <Route path="employees" element={<ProtectedAccess mode="route" resource="employees" action="read"><EmployeeManagement /></ProtectedAccess>} />
              <Route path="roles" element={<ProtectedAccess mode="route" resource="roles" action="read"><RolesManagement /></ProtectedAccess>} />
              
              {/* Activity Logs */}
              <Route path="logs" element={<ProtectedAccess mode="route" resource="logs" action="read"><ActivityLogs /></ProtectedAccess>} />
              
              {/* Profile & Communication */}
              <Route path="profile" element={<AdminProfile />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="chat" element={<ProtectedAccess mode="route" resource="chat" action="read"><AdminChat /></ProtectedAccess>} />

              {/* Security */}
              <Route path="monitoring" element={<ProtectedAccess mode="route" resource="monitoring" action="read"><SecurityMonitoringProvider children={undefined} /></ProtectedAccess>} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}