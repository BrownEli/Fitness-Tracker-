import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Navigation,
  Flame,
  Timer,
  Gauge,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Footprints,
  Sparkles,
  Info,
  Trash2
} from 'lucide-react';
import { JogSession, JogPoint, UserGoals } from '../types';

interface JogTrackerProps {
  selectedDate: string;
  goals: UserGoals;
  isRestDay: boolean;
  onBack: () => void;
  onSaveJog: (session: JogSession) => void;
  existingJogs?: JogSession[];
  onDeleteJog?: (jogId: string) => void;
}

// Calculate distance between two GPS coordinates using the Haversine formula (km)
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format seconds into MM:SS or HH:MM:SS
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function JogTracker({
  selectedDate,
  goals,
  isRestDay,
  onBack,
  onSaveJog,
  existingJogs = [],
  onDeleteJog
}: JogTrackerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentSpeedKmH, setCurrentSpeedKmH] = useState(0);
  const [routePoints, setRoutePoints] = useState<JogPoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'ready' | 'error' | 'simulated'>('acquiring');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string>('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [completedSession, setCompletedSession] = useState<JogSession | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<string>('');

  // Determine user weight in kg for calorie computation
  const userWeightKg =
    goals.weightUnit === 'lbs'
      ? (goals.currentWeight || 165) * 0.453592
      : goals.currentWeight || 75;

  // Calculate calories burned:
  // Formula: Net running energy expenditure is ~1.036 kcal / kg / km.
  // When stationary/slow: Basal + moderate movement (~8.5 METs * weight in kg * duration in hours).
  const caloriesBurned = Math.max(
    0,
    Math.round(
      distanceKm > 0.02
        ? userWeightKg * distanceKm * 1.036 + (durationSeconds / 3600) * (userWeightKg * 1.5)
        : (durationSeconds / 3600) * (userWeightKg * 7.5) // stationary warmup jogging
    )
  );

  // Calculate Average Pace (minutes per km)
  const avgPaceMinPerKm = distanceKm > 0.05 ? (durationSeconds / 60) / distanceKm : 0;
  const formatPace = (pace: number) => {
    if (!pace || pace === Infinity || pace > 30) return '--:--';
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  };

  // Custom pulsing runner marker
  const createRunnerIcon = () => {
    return L.divIcon({
      className: 'jog-runner-icon',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
          <div style="position: absolute; width: 32px; height: 32px; background-color: #6366f1; border-radius: 9999px; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 20px; height: 20px; background-color: #4f46e5; border: 3px solid #ffffff; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: center;">
            <div style="width: 6px; height: 6px; background-color: #ffffff; border-radius: 9999px;"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default to a standard coordinate if GPS is pending (e.g. San Francisco or user location)
    const initialLat = 37.7749;
    const initialLng = -122.4194;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const polyline = L.polyline([], {
      color: '#4f46e5',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    polylineRef.current = polyline;
    mapInstanceRef.current = map;

    // Request initial position
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          setGpsStatus('ready');
          map.setView([latitude, longitude], 17);

          if (!markerRef.current) {
            markerRef.current = L.marker([latitude, longitude], {
              icon: createRunnerIcon()
            }).addTo(map);
          } else {
            markerRef.current.setLatLng([latitude, longitude]);
          }
        },
        (error) => {
          console.warn('Geolocation initial request warning:', error.message);
          setGpsStatus('error');
          setGpsErrorMessage(
            'GPS location unavailable or permission denied. You can enable Simulate Jog to test movement.'
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsStatus('error');
      setGpsErrorMessage('Geolocation is not supported by your browser.');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Timer interval
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRunning, isPaused]);

  // Handle GPS tracking when running
  useEffect(() => {
    if (isRunning && !isPaused && !isSimulating) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed } = position.coords;
            const newPoint: JogPoint = {
              lat: latitude,
              lng: longitude,
              timestamp: Date.now()
            };

            setCurrentLocation({ lat: latitude, lng: longitude });
            if (speed !== null && speed !== undefined && speed >= 0) {
              setCurrentSpeedKmH(speed * 3.6); // m/s to km/h
            }

            // Update Leaflet Marker & Polyline
            if (mapInstanceRef.current) {
              if (!markerRef.current) {
                markerRef.current = L.marker([latitude, longitude], {
                  icon: createRunnerIcon()
                }).addTo(mapInstanceRef.current);
              } else {
                markerRef.current.setLatLng([latitude, longitude]);
              }
              mapInstanceRef.current.panTo([latitude, longitude]);
            }

            setRoutePoints((prevPoints) => {
              if (prevPoints.length > 0) {
                const lastPoint = prevPoints[prevPoints.length - 1];
                const deltaKm = calculateHaversineDistanceKm(
                  lastPoint.lat,
                  lastPoint.lng,
                  latitude,
                  longitude
                );
                // Only count movement if at least 1.5 meters to filter GPS jitter
                if (deltaKm > 0.0015) {
                  setDistanceKm((prevDist) => prevDist + deltaKm);
                  const updated = [...prevPoints, newPoint];
                  if (polylineRef.current) {
                    polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
                  }
                  return updated;
                }
                return prevPoints;
              } else {
                const updated = [newPoint];
                if (polylineRef.current) {
                  polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
                }
                return updated;
              }
            });
          },
          (error) => {
            console.warn('GPS watch error:', error.message);
          },
          { enableHighAccuracy: true, maximumAge: 1000 }
        );
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isRunning, isPaused, isSimulating]);

  // Simulation generator for preview / indoor testing
  useEffect(() => {
    if (isRunning && !isPaused && isSimulating) {
      let currentLat = currentLocation?.lat || 37.7749;
      let currentLng = currentLocation?.lng || -122.4194;
      let angle = 0;

      simulationIntervalRef.current = setInterval(() => {
        angle += 0.15;
        // Simulated speed approx 9.5 km/h (~2.64 m/s => approx 0.000025 deg lat/lng per second)
        const latStep = 0.000025 * (Math.cos(angle) + 0.4);
        const lngStep = 0.00003 * (Math.sin(angle) + 0.6);

        currentLat += latStep;
        currentLng += lngStep;

        const newPoint: JogPoint = {
          lat: currentLat,
          lng: currentLng,
          timestamp: Date.now()
        };

        setCurrentLocation({ lat: currentLat, lng: currentLng });
        setCurrentSpeedKmH(9.6 + Math.sin(angle) * 1.5);

        if (mapInstanceRef.current) {
          if (!markerRef.current) {
            markerRef.current = L.marker([currentLat, currentLng], {
              icon: createRunnerIcon()
            }).addTo(mapInstanceRef.current);
          } else {
            markerRef.current.setLatLng([currentLat, currentLng]);
          }
          mapInstanceRef.current.panTo([currentLat, currentLng]);
        }

        setRoutePoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const delta = calculateHaversineDistanceKm(last.lat, last.lng, currentLat, currentLng);
            setDistanceKm((d) => d + delta);
            const updated = [...prev, newPoint];
            if (polylineRef.current) {
              polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
            }
            return updated;
          }
          const updated = [newPoint];
          if (polylineRef.current) {
            polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
          }
          return updated;
        });
      }, 1000);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    }

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [isRunning, isPaused, isSimulating]);

  // Start Jog Handler
  const handleStartJog = () => {
    if (isRestDay) return;
    setIsRunning(true);
    setIsPaused(false);
    setDurationSeconds(0);
    setDistanceKm(0);
    setRoutePoints([]);
    startTimeRef.current = new Date().toISOString();

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([]);
    }

    // Try to get fresh location
    if ('geolocation' in navigator && !isSimulating) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(pt);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([pt.lat, pt.lng], 17);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  };

  // Pause / Resume
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Stop Jog Handler
  const handleStopJog = () => {
    setIsRunning(false);
    setIsPaused(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Prepare session summary
    const finalSession: JogSession = {
      id: `jog-${Date.now()}`,
      date: selectedDate,
      startTime: startTimeRef.current || new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: Math.max(1, durationSeconds),
      distanceKm: Number(distanceKm.toFixed(3)),
      caloriesBurned: Math.max(1, caloriesBurned),
      avgPaceMinPerKm: Number(avgPaceMinPerKm.toFixed(2)),
      route: routePoints,
      completed: true
    };

    setCompletedSession(finalSession);
    setShowSummaryModal(true);
  };

  // Save Session & Return
  const handleConfirmSaveJog = () => {
    if (completedSession) {
      onSaveJog(completedSession);
    }
    setShowSummaryModal(false);
    onBack();
  };

  // Discard & Reset
  const handleDiscardJog = () => {
    setShowSummaryModal(false);
    setCompletedSession(null);
    setDurationSeconds(0);
    setDistanceKm(0);
    setRoutePoints([]);
    if (polylineRef.current) {
      polylineRef.current.setLatLngs([]);
    }
  };

  // Recenter Map
  const handleRecenter = () => {
    if (currentLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 17);
    }
  };

  return (
    <div className="space-y-6" id="jog-tracker-root">
      {/* Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Return to Workout Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Outdoor Jog & GPS Tracker
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedDate}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live distance tracking, GPS route mapping, and personalized calorie burn computation.
            </p>
          </div>
        </div>

        {/* GPS Status Indicator & Demo Simulation Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsSimulating((prev) => !prev);
              if (!isSimulating) {
                setGpsStatus('simulated');
              } else {
                setGpsStatus('ready');
              }
            }}
            className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center text-center gap-1.5 ${
              isSimulating
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Toggle simulated movement for indoor testing or browser previews"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSimulating ? 'Simulating' : 'Simulate Jog'}
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
              gpsStatus === 'ready'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : gpsStatus === 'simulated'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : gpsStatus === 'acquiring'
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gpsStatus === 'ready'
                  ? 'bg-emerald-500 animate-pulse'
                  : gpsStatus === 'simulated'
                  ? 'bg-amber-500'
                  : gpsStatus === 'acquiring'
                  ? 'bg-sky-500 animate-ping'
                  : 'bg-rose-500'
              }`}
            ></span>
            <span>
              {gpsStatus === 'ready'
                ? 'GPS Signal Active'
                : gpsStatus === 'simulated'
                ? 'Demo GPS Active'
                : gpsStatus === 'acquiring'
                ? 'Acquiring GPS...'
                : 'GPS Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Active Recovery / Rest Day Tip */}
      {isRestDay && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 shadow-2xs">
          <Coffee className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Active Recovery / Rest Day Tip:</span>
            <p className="text-amber-800 text-[11px] font-medium mt-0.5">
              Today is designated as a Rest & Recovery day. Keep your jog or fast walk at a light, conversational pace to support blood flow and active recovery.
            </p>
          </div>
        </div>
      )}

      {/* Top Live HUD Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Distance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Distance</span>
                <Footprints className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                  {distanceKm.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-500">km</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                ≈ {(distanceKm * 0.621371).toFixed(2)} miles
              </div>
            </div>

            {/* Metric 2: Calories Burned */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Burned</span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-amber-600 tracking-tight font-mono">
                  {caloriesBurned}
                </span>
                <span className="text-xs font-bold text-slate-500">kcal</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Based on {Math.round(userWeightKg)} kg body weight
              </div>
            </div>

            {/* Metric 3: Time Elapsed */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Duration</span>
                <Timer className="w-4 h-4 text-sky-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                  {formatDuration(durationSeconds)}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {isRunning ? (isPaused ? 'Session Paused' : 'Live Tracking') : 'Ready to start'}
              </div>
            </div>

            {/* Metric 4: Pace / Speed */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Avg Pace</span>
                <Gauge className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight font-mono">
                  {formatPace(avgPaceMinPerKm)}
                </span>
                <span className="text-xs font-bold text-slate-500">/km</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Speed: {currentSpeedKmH.toFixed(1)} km/h
              </div>
            </div>
          </div>

          {/* Interactive GPS Map View */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Live GPS Route Map
                </span>
                {routePoints.length > 0 && (
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                    {routePoints.length} GPS Waypoints
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRecenter}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center text-center gap-1.5 shadow-2xs"
                title="Center map on current GPS location"
              >
                <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                Recenter
              </button>
            </div>

            {/* Map Container Element */}
            <div className="relative w-full h-[400px] sm:h-[480px] rounded-2xl overflow-hidden border border-slate-200 z-0">
              <div ref={mapContainerRef} className="w-full h-full" id="leaflet-jog-map"></div>

              {/* Floating Overlay Badge on Map */}
              {isRunning && (
                <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-xs text-white px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2.5 z-500 pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <div className="text-xs font-extrabold font-mono">
                    {distanceKm.toFixed(2)} KM &bull; {formatDuration(durationSeconds)}
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar / Controls */}
            <div className="pt-3 flex flex-col gap-3.5 border-t border-slate-100 w-full">
              <div className="text-xs text-slate-500 font-medium text-center">
                {isRunning ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    Jog in progress &bull; Calculating distance and calories
                  </span>
                ) : (
                  <span>Press <strong>Start Jog</strong> to begin GPS route & calorie tracking</span>
                )}
              </div>

              <div className="w-full">
                {!isRunning ? (
                  <button
                    type="button"
                    onClick={handleStartJog}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-150 cursor-pointer flex items-center justify-center text-center gap-2.5"
                    id="start-jog-main-btn"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Start Jog
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-black text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center text-center gap-2"
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={handleStopJog}
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-md shadow-rose-200 cursor-pointer flex items-center justify-center text-center gap-2.5"
                      id="stop-jog-main-btn"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop Jog
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Previous Jogs Logged for this Date */}
          {existingJogs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-800">
                    Logged Jogs for {selectedDate}
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  {existingJogs.length} recorded
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {existingJogs.map((jog, idx) => (
                  <div
                    key={jog.id || idx}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0">
                        <Footprints className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800">
                          {jog.distanceKm.toFixed(2)} km Outdoor Jog
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{formatDuration(jog.durationSeconds)}</span>
                          <span>&bull;</span>
                          <span className="text-amber-600 font-bold">{jog.caloriesBurned} kcal</span>
                          {jog.avgPaceMinPerKm ? (
                            <>
                              <span>&bull;</span>
                              <span>{formatPace(jog.avgPaceMinPerKm)}/km</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {onDeleteJog && (
                      <button
                        type="button"
                        onClick={() => onDeleteJog(jog.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete jog session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

      {/* Jog Completion Summary Modal */}
      {showSummaryModal && completedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-scaleIn">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                Jog Finished & Calculated!
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Great cardio effort! Here is your completed jog workout summary for {selectedDate}.
              </p>
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-indigo-50/70 border border-indigo-150 rounded-2xl text-center space-y-0.5">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">
                  Total Distance
                </span>
                <div className="text-2xl font-black text-indigo-950 font-mono">
                  {completedSession.distanceKm.toFixed(2)} <span className="text-xs">KM</span>
                </div>
                <span className="text-[10px] text-indigo-600 font-medium">
                  {(completedSession.distanceKm * 0.621371).toFixed(2)} miles
                </span>
              </div>

              <div className="p-4 bg-amber-50/70 border border-amber-150 rounded-2xl text-center space-y-0.5">
                <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                  Calories Burnt
                </span>
                <div className="text-2xl font-black text-amber-950 font-mono">
                  {completedSession.caloriesBurned} <span className="text-xs">kcal</span>
                </div>
                <span className="text-[10px] text-amber-700 font-medium">
                  Total energy burned
                </span>
              </div>

              <div className="p-4 bg-sky-50/70 border border-sky-150 rounded-2xl text-center space-y-0.5">
                <span className="text-[10px] font-black uppercase text-sky-900 tracking-wider">
                  Total Duration
                </span>
                <div className="text-2xl font-black text-sky-950 font-mono">
                  {formatDuration(completedSession.durationSeconds)}
                </div>
                <span className="text-[10px] text-sky-700 font-medium">
                  Active tracking time
                </span>
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-150 rounded-2xl text-center space-y-0.5">
                <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider">
                  Average Pace
                </span>
                <div className="text-2xl font-black text-emerald-950 font-mono">
                  {formatPace(completedSession.avgPaceMinPerKm || 0)}
                </div>
                <span className="text-[10px] text-emerald-700 font-medium">
                  min per kilometer
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full">
              <button
                type="button"
                onClick={handleDiscardJog}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveJog}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-colors shadow-md shadow-indigo-200 cursor-pointer flex items-center justify-center text-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Jog to Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
