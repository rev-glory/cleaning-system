import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

export default function Zones() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    name: '',
    floor: '',
    type: 'corridor',
    building_name: ''
  })

  const zoneTypes = [
    'corridor', 'restroom', 'canteen',
    'lobby', 'office', 'open_space', 'stairwell'
  ]

  const load = async () => {
    try {
      const res = await api.get('/zones/')
      setZones(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async e => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/zones/', form)
      setSuccess(`Zone "${form.name}" created successfully`)
      setForm({ name: '', floor: '', type: 'corridor', building_name: '' })
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create zone')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteZone = async (id, name) => {
    if (!confirm(`Delete zone "${name}"?`)) return
    try {
      await api.delete(`/zones/${id}`)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete zone')
    }
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isManager = user.role === 'manager'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Zone management</h2>

        <div className="grid grid-cols-2 gap-8">

          {/* Create zone form — managers only */}
          {isManager && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Add new zone</h3>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">
                  {success}
                </div>
              )}

              <form onSubmit={submit} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Zone name</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Corridor B"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Building name</label>
                  <input
                    required
                    value={form.building_name}
                    onChange={e => setForm({ ...form, building_name: e.target.value })}
                    placeholder="e.g. Main Office"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Floor</label>
                  <input
                    required
                    value={form.floor}
                    onChange={e => setForm({ ...form, floor: e.target.value })}
                    placeholder="e.g. 2"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Zone type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    {zoneTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-1"
                >
                  {submitting ? 'Creating...' : 'Create zone'}
                </button>
              </form>
            </div>
          )}

          {/* Zone list */}
          <div className={isManager ? '' : 'col-span-2'}>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              All zones ({zones.length})
            </h3>
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : zones.length === 0 ? (
              <p className="text-sm text-gray-400">No zones yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {zones.map(z => (
                  <div
                    key={z.id}
                    className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{z.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {z.building_name} · Floor {z.floor} · {z.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                        {z.type}
                      </span>
                      {isManager && (
                        <button
                          onClick={() => deleteZone(z.id, z.name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}