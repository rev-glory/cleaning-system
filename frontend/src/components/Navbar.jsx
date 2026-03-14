import { Link, useNavigate, useLocation } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/scan', label: 'Scan' },
    { to: '/schedule', label: 'Schedule' },
    { to: '/zones', label: 'Zones' },
  ]

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-800">CleanScan</span>
        <div className="flex gap-4">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm ${location.pathname === l.to
                ? 'text-blue-600 font-medium'
                : 'text-gray-500 hover:text-gray-800'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{user.name}</span>
        <button onClick={logout} className="text-sm text-red-500 hover:text-red-700">
          Logout
        </button>
      </div>
    </nav>
  )
}