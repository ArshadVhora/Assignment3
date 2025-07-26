import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Roles } from '../constants/AccessConstants';
import PrivateRoute from '../components/PrivateRoute';

// Lazy-loaded page components
const Dashboard          = lazy(() => import('../pages/Dashboard'));
const DoctorAppointment  = lazy(() => import('../pages/Doctor/DoctorAppointment'));
const Availability       = lazy(() => import('../pages/Doctor/Availability'));
const PatientDirectory   = lazy(() => import('../pages/Doctor/Patientdirectory'));
const Settings           = lazy(() => import('../pages/Doctor/Settings'));
const DoctorChatPage     = lazy(() => import('../pages/Doctor/doctorchatpage'));
const PatientDashboard   = lazy(() => import('../pages/Patient/Patientdashboard'));
const MyAppointments     = lazy(() => import('../pages/Patient/BookAppointments'));
const PharmacyLocator    = lazy(() => import('../pages/Patient/PharmacyLocator'));
const MedicalHistory     = lazy(() => import('../pages/Patient/MedicalHistory'));
const PatientProfile     = lazy(() => import('../pages/Patient/PatientProfile'));
const PatientChatPage    = lazy(() => import('../pages/Patient/patientchatpage'));

const ProtectedRoutes = () => (
  <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
    <Routes>
      {/* Shared routes (accessible to both doctors and users) */}
      <Route element={<PrivateRoute allowedRoles={[Roles.DOCTOR, Roles.USER]} />}>
        {/* e.g. shared dashboard header or notifications */}
      </Route>

      {/* Doctor-specific routes */}
      <Route element={<PrivateRoute allowedRoles={[Roles.DOCTOR]} />}>
        <Route path="/doctor/dashboard"        element={<Dashboard />} />
        <Route path="/doctor/appointment"      element={<DoctorAppointment />} />
        <Route path="/availability"            element={<Availability />} />
        <Route path="/patient-directory"      element={<PatientDirectory />} />
        <Route path="/settings"                element={<Settings />} />
        <Route path="/doctor/chat/:patientId" element={<DoctorChatPage />} />
      </Route>

      {/* Patient-specific routes */}
      <Route element={<PrivateRoute allowedRoles={[Roles.USER]} />}>
        <Route path="/patient/dashboard"       element={<PatientDashboard />} />
        <Route path="/patient/book-appointment" element={<MyAppointments />} />
        <Route path="/pharmacy-locator"        element={<PharmacyLocator />} />
        <Route path="/patient/medical-history" element={<MedicalHistory />} />
        <Route path="/patient/profile"         element={<PatientProfile />} />
        <Route path="/patient/chat"            element={<PatientChatPage />} />
      </Route>
    </Routes>
  </Suspense>
);

export default ProtectedRoutes;
