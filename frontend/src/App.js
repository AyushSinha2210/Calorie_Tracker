import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './Pages/Login';
import Register from './Pages/Register';
import VerifyEmail from './Pages/VerifyEmail';
import ForgotPassword from './Pages/ForgotPassword';
import Dashboard from './Pages/Dashboard';
import ProfileSetup from './Pages/ProfileSetup';
import Profile from './Pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

const Home = () => (
  <div>
    <header>
      <h1>AI Food & Fitness Tracker</h1>
      <p>Track your fitness journey with AI-powered insights</p>
      <div><Link to="/login">Login</Link><Link to="/register">Register</Link></div>
    </header>
  </div>
);

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/profile-setup" element={<ProtectedRoute skipProfileCheck><ProfileSetup /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>
);

export default App;
