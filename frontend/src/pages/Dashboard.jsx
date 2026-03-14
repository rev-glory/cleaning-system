import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

const severityColor = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
}

export default function Dashboard() {
  const [zones, setZones] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const z = await api.get('/zones/')
        setZones(z.data)
        const all = await Promise.all(
          z.data.map(zone => api.get(`/analyze/history/${zone.id}`))
        )
        setAnalyses(all.flatMap(r => r.data))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const pending = analyses.filter(a => a.schedule_status === 'pending').length
  const avgScore = analyses.length
    ? Math.round(analyses.reduce((s, a) => s + a.cleanliness_score, 0) / analyses.length)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Overview</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Zones', value: zones.length },
            { label: 'Avg cleanliness', value: `${avgScore}%` },
            { label: 'Pending cleans', value: pending },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-semibold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>
        <h3 className="text-sm font-medium text-gray-600 mb-3">Recent scans</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-gray-400">No scans yet — go to Scan to get started.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {analyses.slice(0, 10).map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Score: {a.cleanliness_score}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.analyzed_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${severityColor[a.severity]}`}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-gray-400">{a.detections_count} items</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}