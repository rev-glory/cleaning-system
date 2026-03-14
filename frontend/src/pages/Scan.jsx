import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

const severityColor = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600'
}

export default function Scan() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [zones, setZones] = useState([])
  const [zoneId, setZoneId] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/zones/').then(r => {
      setZones(r.data)
      if (r.data.length > 0) setZoneId(r.data[0].id)
    })
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      videoRef.current.srcObject = stream
      setStreaming(true)
      setError('')
    } catch {
      setError('Camera access denied. Please allow camera permission.')
    }
  }

  const capture = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      setCaptured(blob)
      video.srcObject?.getTracks().forEach(t => t.stop())
      setStreaming(false)
    }, 'image/jpeg', 0.85)
  }

  const retake = () => {
    setCaptured(null)
    setResult(null)
    startCamera()
  }

  const submit = async () => {
    if (!captured || !zoneId) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('zone_id', zoneId)
      form.append('file', captured, 'capture.jpg')
      const res = await api.post('/analyze/', form)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Scan a zone</h2>
        <div className="mb-4">
          <label className="text-sm text-gray-600 mb-1 block">Select zone</label>
          <select
            value={zoneId}
            onChange={e => setZoneId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name} — {z.building_name}</option>
            ))}
          </select>
        </div>
        {!captured && (
          <div className="relative bg-black rounded-xl overflow-hidden mb-4 aspect-video flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full" />
            {!streaming && (
              <button
                onClick={startCamera}
                className="absolute bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Open camera
              </button>
            )}
          </div>
        )}
        {captured && !result && (
          <div className="mb-4">
            <img
              src={URL.createObjectURL(captured)}
              className="w-full rounded-xl border border-gray-200"
              alt="Captured"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-3 mb-6">
          {streaming && (
            <button
              onClick={capture}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
            >
              Capture
            </button>
          )}
          {captured && !result && (
            <>
              <button
                onClick={retake}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Retake
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Analysing...' : 'Analyse'}
              </button>
            </>
          )}
        </div>
        {result && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-gray-600">Cleanliness score</p>
              <p className={`text-2xl font-semibold ${severityColor[result.severity]}`}>
                {result.cleanliness_score}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Severity', value: result.severity },
                { label: 'Priority', value: result.schedule.priority },
                { label: 'Items detected', value: result.detections.length },
                { label: 'Duration', value: `${result.schedule.duration_minutes} min` },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-sm font-medium text-gray-700 capitalize">{s.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-4">{result.schedule.notes}</p>
            {result.zone_map_url && (
              <img
                src={result.zone_map_url}
                className="w-full rounded-lg border border-gray-100"
                alt="Zone map"
              />
            )}
            <button
              onClick={retake}
              className="mt-4 w-full border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
            >
              Scan again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}