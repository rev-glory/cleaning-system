import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

const severityColor = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600'
}

const severityBg = {
  low: 'bg-green-50 border-green-200',
  medium: 'bg-yellow-50 border-yellow-200',
  high: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200'
}

const ScoreBar = ({ score }) => {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
    </div>
  )
}

export default function Scan() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const [zones, setZones] = useState([])
  const [zoneId, setZoneId] = useState('')
  const [mode, setMode] = useState('camera') // 'camera' or 'upload'
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/zones/').then(r => {
      setZones(r.data)
      if (r.data.length > 0) setZoneId(r.data[0].id)
    })
  }, [])

  useEffect(() => {
    let interval
    if (loading) {
      setElapsed(0)
      interval = setInterval(() => {
        setElapsed(e => {
          const next = e + 1
          if (next < 5) setLoadingMsg('Uploading image...')
          else if (next < 15) setLoadingMsg('Running privacy processing...')
          else if (next < 30) setLoadingMsg('Detecting objects...')
          else if (next < 45) setLoadingMsg('Scoring cleanliness...')
          else setLoadingMsg('Almost done...')
          return next
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [loading])

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
      setPreviewUrl(URL.createObjectURL(blob))
      video.srcObject?.getTracks().forEach(t => t.stop())
      setStreaming(false)
    }, 'image/jpeg', 0.85)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Only JPEG and PNG files are accepted')
      return
    }
    setCaptured(file)
    setPreviewUrl(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  const reset = () => {
    setCaptured(null)
    setPreviewUrl(null)
    setResult(null)
    setError('')
    if (mode === 'camera') startCamera()
    if (fileRef.current) fileRef.current.value = ''
  }

  const switchMode = (m) => {
    setMode(m)
    setCaptured(null)
    setPreviewUrl(null)
    setResult(null)
    setError('')
    if (streaming) {
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
      setStreaming(false)
    }
  }

  const submit = async () => {
    if (!captured || !zoneId) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('zone_id', zoneId)
      form.append('file', captured, 'capture.jpg')
      const res = await api.post('/analyze/', form, { timeout: 120000 })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed. Try again.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Scan a zone</h2>

        {/* Zone selector */}
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

        {/* Mode switcher */}
        {!result && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
            {[
              { id: 'camera', label: 'Camera' },
              { id: 'upload', label: 'Upload image' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === m.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Camera mode */}
        {mode === 'camera' && !captured && (
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

        {/* Upload mode */}
        {mode === 'upload' && !captured && (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 mb-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-600">Click to upload an image</p>
            <p className="text-xs text-gray-400 mt-1">JPEG or PNG — max 10MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Preview */}
        {previewUrl && !result && (
          <div className="mb-4">
            <img
              src={previewUrl}
              className="w-full rounded-xl border border-gray-200"
              alt="Preview"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-blue-700">{loadingMsg || 'Analysing...'}</p>
            </div>
            <p className="text-xs text-blue-400">{elapsed}s elapsed</p>
          </div>
        )}

        {/* Actions */}
        {!loading && !result && (
          <div className="flex gap-3 mb-6">
            {mode === 'camera' && streaming && (
              <button
                onClick={capture}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
              >
                Capture
              </button>
            )}
            {captured && (
              <>
                <button
                  onClick={reset}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
                >
                  {mode === 'camera' ? 'Retake' : 'Choose different'}
                </button>
                <button
                  onClick={submit}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
                >
                  Analyse
                </button>
              </>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Cleanliness score</p>
                <p className={`text-3xl font-semibold ${severityColor[result.severity]}`}>
                  {result.cleanliness_score}
                  <span className="text-sm font-normal text-gray-400">/100</span>
                </p>
              </div>
              <ScoreBar score={result.cleanliness_score} />
            </div>

            {result.humans_detected && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs font-medium text-green-600">Privacy protected — humans detected and removed before analysis</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Severity', value: result.severity },
                // Use Optional Chaining to prevent crash if schedule is null
                { label: 'Priority', value: result.schedule?.priority || 'None' },
                { label: 'Objects detected', value: result.detections.length },
                { label: 'Est. clean time', value: result.schedule ? `${result.schedule.duration_minutes} min` : 'N/A' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-sm font-medium text-gray-700 capitalize">{s.value}</p>
                </div>
              ))}
            </div>

            {/* FIX: Only render the "Recommended action" box if a schedule exists */}
            {result.schedule ? (
              <div className={`rounded-lg border px-4 py-3 mb-4 ${severityBg[result.severity] || 'bg-gray-50 border-gray-200'}`}>
                <p className="text-xs font-medium text-gray-600 mb-1">Recommended action</p>
                <p className="text-sm text-gray-700">{result.schedule.notes}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Clean by: {new Date(result.schedule.suggested_window).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-green-700 font-medium">This zone is clean</p>
                <p className="text-xs text-green-600 mt-0.5">No immediate cleaning scheduled.</p>
              </div>
            )}

            {result.detections.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Detected objects</p>
                <div className="flex flex-wrap gap-2">
                  {result.detections.map((d, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {d.label} {Math.round(d.confidence * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.zone_map_url && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Zone map</p>
                <img
                  src={result.zone_map_url}
                  className="w-full rounded-lg border border-gray-100"
                  alt="Zone map"
                />
              </div>
            )}

            <button
              onClick={reset}
              className="w-full border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
            >
              Scan again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}