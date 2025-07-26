import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy-loaded public page components
const Analytics           = lazy(() => import('../pages/Analytics'));
const Home                = lazy(() => import('../pages/HomePage/Home'));
const LoginPage           = lazy(() => import('../pages/Auth/LoginPage'));
const PatientRegister     = lazy(() => import('../pages/Auth/PatientRegister'));
const DoctorRegister      = lazy(() => import('../pages/Auth/DoctorRegister'));
const GoogleAuthSuccess   = lazy(() => import('../pages/Auth/GoogleAuthSuccess'));
const EmailVerification   = lazy(() => import('../pages/Auth/EmailVerification'));
const UnauthorizedPage    = lazy(() => import('../pages/Auth/UnauthorizedPage'));

const PublicRoutes = () => (
  <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
    <Routes>
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/patient-register" element={<PatientRegister />} />
      <Route path="/doctor-register" element={<DoctorRegister />} />
      <Route path="/google-auth-success" element={<GoogleAuthSuccess />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
    </Routes>
  </Suspense>
);

export default PublicRoutes;
