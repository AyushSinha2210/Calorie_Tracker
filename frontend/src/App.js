import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './Pages/Login';
import Register from './Pages/Register';
import Dashboard from './Pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import logo from './logo.svg';
import './App.css';

function Home() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Food & Fitness Tracker</h1>
        <img src={logo} className="App-logo" alt="logo" />
        <p>Track your fitness journey with AI-powered insights</p>
        <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
          <Link to="/login" style={{ padding: '10px 30px', background: '#61dafb', color: '#282c34', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }}>
            Login
          </Link>
          <Link to="/register" style={{ padding: '10px 30px', background: '#667eea', color: 'white', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }}>
            Register
          </Link>
        </div>
      </header>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
