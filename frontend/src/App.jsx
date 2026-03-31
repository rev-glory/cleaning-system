import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Scan from './pages/Scan'
import Schedule from './pages/Schedule'
import Zones from './pages/Zones'
import PrivateRoute from './components/PrivateRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/scan" element={<PrivateRoute><Scan /></PrivateRoute>} />
        <Route path="/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
        <Route path="/zones" element={<PrivateRoute><Zones /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}