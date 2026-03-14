import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

const priorityColor = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
}

export default function Schedule() {
  const [zones, setZones] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const z = await api.get('/zones/')
      setZones(z.data)
      const all = await Promise.all(
        z.data.map(zone => api.get(`/analyze/history/${zone.id}`))
      )
      const flat = all.flatMap((r, i) =>
        r.data.map(a => ({ ...a, zone_name: z.data[i].name }))
      )
      setAnalyses(flat.filter(a => a.schedule_status === 'pending'))
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Cleaning schedule</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-gray-400">No pending cleaning sessions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {analyses.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.zone_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Scanned {new Date(a.analyzed_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {a.detections_count} items · score {a.cleanliness_score}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">
                    pending
                  </span>
                </div>
                <button
                  onClick={() => markComplete(a.id)}
                  className="mt-4 w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700"
                >
                  Mark as cleaned
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}