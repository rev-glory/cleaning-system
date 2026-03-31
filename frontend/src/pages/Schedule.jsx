import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

const priorityColor = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
}

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }

export default function Schedule() {
  const [analyses, setAnalyses] = useState([])
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  const load = async () => {
    try {
      const z = await api.get('/zones/')
      const all = await Promise.all(
        z.data.map(zone => api.get(`/analyze/history/${zone.id}`))
      )
      const flat = all.flatMap((r, i) =>
        r.data.map(a => ({ ...a, zone_name: z.data[i].name }))
      )
      const pending = flat
        .filter(a => a.schedule_status === 'pending')
        .sort((a, b) => (priorityOrder[a.schedule_status] || 3) - (priorityOrder[b.schedule_status] || 3))
      setAnalyses(pending)
      setCompleted(flat.filter(a => a.schedule_status === 'completed').slice(0, 20))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markComplete = async (id) => {
    try {
      await api.patch(`/analyze/session/${id}/complete`)
      load()
    } catch (e) {
      console.error(e)
    }
  }

  const timeUntil = (dateStr) => {
    const diff = new Date(dateStr) - new Date()
    if (diff < 0) return 'overdue'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `in ${mins} min`
    const hrs = Math.floor(mins / 60)
    return `in ${hrs}h`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Cleaning schedule</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          {[
            { id: 'pending', label: `Pending (${analyses.length})` },
            { id: 'completed', label: `Completed (${completed.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : tab === 'pending' ? (
          analyses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm font-medium text-gray-600">All zones are clean</p>
              <p className="text-xs text-gray-400 mt-1">No pending cleaning sessions.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {analyses.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.zone_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Scanned {new Date(a.analyzed_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColor[a.schedule_status] || 'bg-gray-100 text-gray-600'}`}>
                      pending
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400">Score</p>
                      <p className="text-sm font-semibold text-gray-800">{a.cleanliness_score}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400">Items</p>
                      <p className="text-sm font-semibold text-gray-800">{a.detections_count}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400">Severity</p>
                      <p className="text-sm font-semibold text-gray-800 capitalize">{a.severity || '—'}</p>
                    </div>
                  </div>

                  {a.zone_map_url && (
                    <img
                      src={a.zone_map_url}
                      className="w-full rounded-lg border border-gray-100 mb-3 object-cover max-h-40"
                      alt="Zone map"
                    />
                  )}

                  <button
                    onClick={() => markComplete(a.id)}
                    className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700"
                  >
                    Mark as cleaned
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          completed.length === 0 ? (
            <p className="text-sm text-gray-400">No completed sessions yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {completed.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.zone_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Scanned {new Date(a.analyzed_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Score: {a.cleanliness_score} · {a.detections_count} items</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                    cleaned
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}