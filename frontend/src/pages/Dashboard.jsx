import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

const severityColor = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
}

const scoreColor = score => {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  if (score >= 25) return 'text-orange-600'
  return 'text-red-600'
}

const ScoreBar = ({ score }) => {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  )
}

export default function Dashboard() {
  const [zones, setZones] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [zoneScores, setZoneScores] = useState({})
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    const load = async () => {
      try {
        const z = await api.get('/zones/')
        setZones(z.data)
        const all = await Promise.all(
          z.data.map(zone => api.get(`/analyze/history/${zone.id}`))
        )
        const flat = all.flatMap(r => r.data)
        setAnalyses(flat)

        // Compute latest score per zone
        const scores = {}
        all.forEach((r, i) => {
          if (r.data.length > 0) {
            scores[z.data[i].id] = {
              name: z.data[i].name,
              score: r.data[0].cleanliness_score,
              severity: r.data[0].severity,
              scans: r.data.length,
              lastScan: r.data[0].analyzed_at
            }
          }
        })
        setZoneScores(scores)
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
  const critical = analyses.filter(a => a.severity === 'critical' && a.schedule_status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
          <p className="text-sm text-gray-400">Welcome, {user.name}</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Zones', value: zones.length, sub: 'registered' },
            { label: 'Avg score', value: `${avgScore}`, sub: 'cleanliness' },
            { label: 'Pending', value: pending, sub: 'cleanings' },
            { label: 'Critical', value: critical, sub: 'urgent now', red: critical > 0 },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.red ? 'text-red-600' : 'text-gray-800'}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Zone scores */}
        {Object.keys(zoneScores).length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Zone cleanliness</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(zoneScores).map(([id, z]) => (
                <div key={id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-800">{z.name}</p>
                    <p className={`text-lg font-semibold ${scoreColor(z.score)}`}>{z.score}</p>
                  </div>
                  <ScoreBar score={z.score} />
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor[z.severity]}`}>
                      {z.severity}
                    </span>
                    <span className="text-xs text-gray-400">{z.scans} scans</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent scans */}
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