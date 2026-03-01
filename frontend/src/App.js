import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Login from './Pages/Login';
import Register from './Pages/Register';
import VerifyEmail from './Pages/VerifyEmail';
import ForgotPassword from './Pages/ForgotPassword';
import Dashboard from './Pages/Dashboard';
import ProfileSetup from './Pages/ProfileSetup';
import Profile from './Pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

const Home = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-lg w-full">
      <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-accent-500 mb-4">
        AI Food & Fitness Tracker
      </h1>
      <p className="text-gray-600 mb-8 text-lg">Track your fitness journey with AI-powered insights</p>
      <div className="flex gap-4 justify-center">
        <Link to="/login" className="px-6 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors shadow-md hover:shadow-lg">Login</Link>
        <Link to="/register" className="px-6 py-3 bg-white text-brand-600 border-2 border-brand-100 rounded-xl font-semibold hover:border-brand-500 hover:bg-brand-50 transition-all">Register</Link>
      </div>
    </div>
  </div>
);

// Wrapper for animated page transitions
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: "easeInOut" }}
    className="min-h-screen"
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
        <Route path="/verify-email" element={<PageTransition><VerifyEmail /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
        <Route path="/profile-setup" element={<ProtectedRoute skipProfileCheck><PageTransition><ProfileSetup /></PageTransition></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><PageTransition><Profile /></PageTransition></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <BrowserRouter>
    <AnimatedRoutes />
  </BrowserRouter>
);

export default App;
