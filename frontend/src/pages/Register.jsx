import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (e) {
      setError(e.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-gray-800 mb-1">CleanScan</h1>
        <p className="text-sm text-gray-500 mb-6">Create your account</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Full name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Role</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              <option value="staff">Staff — scans zones</option>
              <option value="manager">Manager — views dashboard</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}