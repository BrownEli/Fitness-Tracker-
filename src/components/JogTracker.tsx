import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Play,
  Square,
  Pause,
  Navigation,
  Flame,
  Timer,
  Gauge,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Footprints,
  Sparkles,
  Trash2,
  Pencil,
  X,
  Clock,
  Route
} from 'lucide-react';
import { JogSession, JogPoint, UserGoals } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';
import { ConfirmModal } from './ConfirmModal';
import {
  calculateHaversineDistanceKm,
  fetchPedestrianRoute,
  snapRouteToPedestrianStreets,
  detectStraightLineGaps
} from '../utils/geoRouting';
import { backgroundKeepAlive } from '../utils/backgroundKeepAlive';

export { calculateHaversineDistanceKm };

interface JogTrackerProps {
  selectedDate: string;
  goals: UserGoals;
  isRestDay: boolean;
  onBack: () => void;
  onSaveJog: (session: JogSession) => void;
  onUpdateJog?: (session: JogSession) => void;
  existingJogs?: JogSession[];
  onDeleteJog?: (jogId: string) => void;
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

const ACTIVE_CARDIO_STORAGE_KEY = 'active_cardio_session_state';

export default function JogTracker({
  selectedDate,
  goals,
  isRestDay,
  onBack,
  onSaveJog,
  onUpdateJog,
  existingJogs = [],
  onDeleteJog
}: JogTrackerProps) {
  // Activity mode: 'fast_walk' or 'jog', defaulted to saved preference or 'fast_walk'
  const [activityType, setActivityType] = useState<'fast_walk' | 'jog'>(() => {
    return (localStorage.getItem('preferred_cardio_activity') as 'fast_walk' | 'jog') || 'fast_walk';
  });

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
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Manual duration editing in completion modal
  const [manualDurationMins, setManualDurationMins] = useState<number>(0);
  const [manualDurationSecs, setManualDurationSecs] = useState<number>(0);
  const [isAdjustingSummaryTime, setIsAdjustingSummaryTime] = useState<boolean>(false);

  // Edit past recorded session modal state
  const [editingJog, setEditingJog] = useState<JogSession | null>(null);
  const [editDurationMins, setEditDurationMins] = useState<number>(0);
  const [editDurationSecs, setEditDurationSecs] = useState<number>(0);
  const [editDistanceKm, setEditDistanceKm] = useState<number>(0);
  const [editActivityType, setEditActivityType] = useState<'fast_walk' | 'jog'>('fast_walk');

  const [isSnappingStreets, setIsSnappingStreets] = useState(false);
  const [snapNotification, setSnapNotification] = useState<string | null>(null);
  const gpsPollIntervalRef = useRef<any>(null);

  const hasStraightGaps = detectStraightLineGaps(routePoints, 0.04);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Real wall-clock timing refs to prevent background timer freeze
  const startTimeMsRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0);
  const startTimeRef = useRef<string>('');

  // Determine user weight in kg for calorie computation
  const userWeightKg =
    goals.weightUnit === 'lbs'
      ? (goals.currentWeight || 165) * 0.453592
      : goals.currentWeight || 75;

  // Exact wall-clock elapsed seconds computation
  const getExactElapsedSeconds = (): number => {
    let totalMs = accumulatedMsRef.current;
    if (startTimeMsRef.current !== null) {
      totalMs += Math.max(0, Date.now() - startTimeMsRef.current);
    }
    return Math.floor(totalMs / 1000);
  };

  // Scientific calorie expenditure computation:
  // - Fast Walk (~5.0 - 6.5 km/h): ACSM net walking formula ~0.72 kcal / kg / km.
  // - Outdoor Jog (~8.0 - 10 km/h): Net running formula ~1.036 kcal / kg / km.
  const calculateCalories = (distKm: number, durationSecs: number, type: 'fast_walk' | 'jog'): number => {
    const hours = durationSecs / 3600;
    if (type === 'fast_walk') {
      return Math.max(
        1,
        Math.round(
          distKm > 0.02
            ? userWeightKg * distKm * 0.72 + hours * (userWeightKg * 1.2)
            : hours * (userWeightKg * 3.8)
        )
      );
    } else {
      return Math.max(
        1,
        Math.round(
          distKm > 0.02
            ? userWeightKg * distKm * 1.036 + hours * (userWeightKg * 1.5)
            : hours * (userWeightKg * 7.5)
        )
      );
    }
  };

  const caloriesBurned = calculateCalories(distanceKm, durationSeconds, activityType);

  // Calculate Average Pace (minutes per km)
  const avgPaceMinPerKm = distanceKm > 0.05 ? (durationSeconds / 60) / distanceKm : 0;
  const formatPace = (pace: number) => {
    if (!pace || pace === Infinity || pace > 30) return '--:--';
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  };

  // Screen Wake Lock helper to keep tracking alive
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Ignored if unsupported or permission denied
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
  };

  // Local storage persistence helper
  const syncToLocalStorage = (running: boolean, paused: boolean, dist: number, pts: JogPoint[]) => {
    if (!running) {
      localStorage.removeItem(ACTIVE_CARDIO_STORAGE_KEY);
      return;
    }
    try {
      localStorage.setItem(
        ACTIVE_CARDIO_STORAGE_KEY,
        JSON.stringify({
          date: selectedDate,
          activityType,
          isRunning: running,
          isPaused: paused,
          startTimeIso: startTimeRef.current,
          startTimeMs: startTimeMsRef.current,
          accumulatedMs: accumulatedMsRef.current,
          distanceKm: dist,
          routePoints: pts
        })
      );
    } catch (e) {
      console.warn('Failed to save cardio state to localStorage:', e);
    }
  };

  // Restore active session on mount
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(ACTIVE_CARDIO_STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved && saved.date === selectedDate && saved.isRunning) {
          accumulatedMsRef.current = saved.accumulatedMs || 0;
          startTimeMsRef.current = saved.isPaused ? null : (saved.startTimeMs || Date.now());
          startTimeRef.current = saved.startTimeIso || new Date().toISOString();
          setActivityType(saved.activityType || 'fast_walk');
          setDistanceKm(saved.distanceKm || 0);
          setRoutePoints(saved.routePoints || []);
          setIsRunning(true);
          setIsPaused(Boolean(saved.isPaused));

          let totalMs = saved.accumulatedMs || 0;
          if (!saved.isPaused && saved.startTimeMs) {
            totalMs += Math.max(0, Date.now() - saved.startTimeMs);
          }
          setDurationSeconds(Math.floor(totalMs / 1000));

          if (!saved.isPaused) {
            requestWakeLock();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore active cardio state:', e);
    }
  }, [selectedDate]);

  // Handle visibility changes and window focus: immediately recalculate from wall-clock
  useEffect(() => {
    const handleSyncOnForeground = () => {
      if (isRunning && !isPaused) {
        const exact = getExactElapsedSeconds();
        setDurationSeconds(exact);
        if (document.visibilityState === 'visible') {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleSyncOnForeground);
    window.addEventListener('focus', handleSyncOnForeground);
    return () => {
      document.removeEventListener('visibilitychange', handleSyncOnForeground);
      window.removeEventListener('focus', handleSyncOnForeground);
    };
  }, [isRunning, isPaused]);

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

  // Sync polyline if route points exist
  useEffect(() => {
    if (polylineRef.current && routePoints.length > 0) {
      polylineRef.current.setLatLngs(routePoints.map((p) => [p.lat, p.lng]));
    }
  }, [routePoints]);

  // Timer interval: recalculates from wall-clock Date.now() every second
  useEffect(() => {
    if (isRunning && !isPaused) {
      // Immediate sync
      setDurationSeconds(getExactElapsedSeconds());

      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds(getExactElapsedSeconds());
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRunning, isPaused]);

  // Core location processor shared by continuous watchPosition & periodic hardware wake polling
  const processIncomingLocation = (coords: {
    latitude: number;
    longitude: number;
    speed?: number | null;
  }) => {
    const { latitude, longitude, speed } = coords;
    const now = Date.now();
    const newPoint: JogPoint = {
      lat: latitude,
      lng: longitude,
      timestamp: now
    };

    setCurrentLocation({ lat: latitude, lng: longitude });
    setDurationSeconds(getExactElapsedSeconds());

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

        // Filter out small jitter (< 1.5 meters)
        if (deltaKm <= 0.0015) {
          return prevPoints;
        }

        if (speed === null || speed === undefined || speed < 0) {
          const timeDeltaSec = Math.max(1, (now - lastPoint.timestamp) / 1000);
          const calcSpeed = deltaKm / (timeDeltaSec / 3600);
          if (calcSpeed < 45) {
            setCurrentSpeedKmH(calcSpeed);
          }
        }

        // If large gap (>= 40 meters, e.g. phone was locked in pocket or GPS signal paused)
        if (deltaKm >= 0.04) {
          const immediateUpdated = [...prevPoints, newPoint];
          setDistanceKm((prevDist) => {
            const newDist = prevDist + deltaKm;
            syncToLocalStorage(true, false, newDist, immediateUpdated);
            return newDist;
          });

          if (polylineRef.current) {
            polylineRef.current.setLatLngs(immediateUpdated.map((p) => [p.lat, p.lng]));
          }

          // Asynchronously query pedestrian street route to snap to actual sidewalks/roads
          fetchPedestrianRoute(lastPoint, newPoint)
            .then((route) => {
              if (route && route.coordinates.length > 1) {
                const addedDistanceKm = Math.max(0, route.distanceKm - deltaKm);
                const intermediate = route.coordinates.slice(1);
                const timeSpan = Math.max(1000, newPoint.timestamp - lastPoint.timestamp);
                const stepTime = timeSpan / intermediate.length;
                const newIntermediatePoints: JogPoint[] = intermediate.map((coord, idx) => ({
                  lat: coord.lat,
                  lng: coord.lng,
                  timestamp: Math.round(lastPoint.timestamp + stepTime * (idx + 1))
                }));

                setRoutePoints((currentPts) => {
                  const base = currentPts.slice(0, currentPts.length - 1);
                  const routed = [...base, ...newIntermediatePoints];
                  if (polylineRef.current) {
                    polylineRef.current.setLatLngs(routed.map((p) => [p.lat, p.lng]));
                  }
                  setDistanceKm((prevDist) => {
                    const updatedDist = prevDist + addedDistanceKm;
                    syncToLocalStorage(true, false, updatedDist, routed);
                    return updatedDist;
                  });
                  return routed;
                });
              }
            })
            .catch(() => {});

          return immediateUpdated;
        }

        // Normal continuous step (< 40m)
        const updated = [...prevPoints, newPoint];
        setDistanceKm((prevDist) => {
          const newDist = prevDist + deltaKm;
          syncToLocalStorage(true, false, newDist, updated);
          return newDist;
        });

        if (polylineRef.current) {
          polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
        }
        return updated;
      } else {
        const updated = [newPoint];
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
        }
        syncToLocalStorage(true, false, distanceKm, updated);
        return updated;
      }
    });
  };

  // Handle continuous GPS tracking and periodic hardware wake polling
  useEffect(() => {
    if (isRunning && !isPaused && !isSimulating) {
      if ('geolocation' in navigator) {
        // Continuous watch
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            processIncomingLocation(position.coords);
          },
          (error) => {
            console.warn('GPS watch error:', error.message);
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
        );

        // Active periodic hardware polling (every 20s) to keep GPS hardware awake and log steady waypoints
        gpsPollIntervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              processIncomingLocation(position.coords);
            },
            (error) => {
              console.warn('Periodic GPS ping error:', error.message);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
          );
        }, 20000);
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (gpsPollIntervalRef.current) {
        clearInterval(gpsPollIntervalRef.current);
        gpsPollIntervalRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (gpsPollIntervalRef.current) {
        clearInterval(gpsPollIntervalRef.current);
        gpsPollIntervalRef.current = null;
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
        const speedFactor = activityType === 'fast_walk' ? 0.000016 : 0.000025;
        const latStep = speedFactor * (Math.cos(angle) + 0.4);
        const lngStep = speedFactor * 1.2 * (Math.sin(angle) + 0.6);

        currentLat += latStep;
        currentLng += lngStep;

        const newPoint: JogPoint = {
          lat: currentLat,
          lng: currentLng,
          timestamp: Date.now()
        };

        setCurrentLocation({ lat: currentLat, lng: currentLng });
        setCurrentSpeedKmH(activityType === 'fast_walk' ? 5.8 + Math.sin(angle) * 0.8 : 9.6 + Math.sin(angle) * 1.5);
        setDurationSeconds(getExactElapsedSeconds());

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
            const updated = [...prev, newPoint];
            setDistanceKm((d) => {
              const newDist = d + delta;
              syncToLocalStorage(true, false, newDist, updated);
              return newDist;
            });
            if (polylineRef.current) {
              polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
            }
            return updated;
          }
          const updated = [newPoint];
          if (polylineRef.current) {
            polylineRef.current.setLatLngs(updated.map((p) => [p.lat, p.lng]));
          }
          syncToLocalStorage(true, false, distanceKm, updated);
          return updated;
        });
      }, 1000);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    }

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  }, [isRunning, isPaused, isSimulating, activityType]);

  // Start Session Handler
  const handleStartActivity = () => {
    if (isRestDay) return;
    const now = Date.now();
    startTimeMsRef.current = now;
    accumulatedMsRef.current = 0;
    startTimeRef.current = new Date(now).toISOString();
    setIsRunning(true);
    setIsPaused(false);
    setDurationSeconds(0);
    setDistanceKm(0);
    setRoutePoints([]);

    syncToLocalStorage(true, false, 0, []);
    requestWakeLock();
    backgroundKeepAlive.start(
      activityType === 'fast_walk' ? 'Outdoor Walk in Progress' : 'Outdoor Jog in Progress'
    );

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([]);
    }

    // Immediate location refresh
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
    if (isPaused) {
      // Resuming
      startTimeMsRef.current = Date.now();
      setIsPaused(false);
      const elapsed = getExactElapsedSeconds();
      setDurationSeconds(elapsed);
      syncToLocalStorage(true, false, distanceKm, routePoints);
      requestWakeLock();
      backgroundKeepAlive.start(
        activityType === 'fast_walk' ? 'Outdoor Walk in Progress' : 'Outdoor Jog in Progress'
      );
    } else {
      // Pausing
      if (startTimeMsRef.current !== null) {
        accumulatedMsRef.current += Math.max(0, Date.now() - startTimeMsRef.current);
        startTimeMsRef.current = null;
      }
      setIsPaused(true);
      const elapsed = Math.floor(accumulatedMsRef.current / 1000);
      setDurationSeconds(elapsed);
      syncToLocalStorage(true, true, distanceKm, routePoints);
      releaseWakeLock();
      backgroundKeepAlive.stop();
    }
  };

  // Stop Session Handler
  const handleStopActivity = () => {
    const finalSeconds = getExactElapsedSeconds();
    setIsRunning(false);
    setIsPaused(false);
    if (startTimeMsRef.current !== null) {
      accumulatedMsRef.current += Math.max(0, Date.now() - startTimeMsRef.current);
      startTimeMsRef.current = null;
    }
    setDurationSeconds(finalSeconds);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (gpsPollIntervalRef.current) {
      clearInterval(gpsPollIntervalRef.current);
      gpsPollIntervalRef.current = null;
    }
    releaseWakeLock();
    backgroundKeepAlive.stop();
    syncToLocalStorage(false, false, 0, []);

    const finalDistance = Number(distanceKm.toFixed(3));
    const finalDuration = Math.max(1, finalSeconds);
    const finalPace = finalDistance > 0.05 ? (finalDuration / 60) / finalDistance : 0;
    const finalCals = calculateCalories(finalDistance, finalDuration, activityType);

    const finalSession: JogSession = {
      id: `cardio-${Date.now()}`,
      date: selectedDate,
      activityType,
      startTime: startTimeRef.current || new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: finalDuration,
      distanceKm: finalDistance,
      caloriesBurned: finalCals,
      avgPaceMinPerKm: Number(finalPace.toFixed(2)),
      route: routePoints,
      completed: true
    };

    setCompletedSession(finalSession);
    setManualDurationMins(Math.floor(finalDuration / 60));
    setManualDurationSecs(finalDuration % 60);
    setIsAdjustingSummaryTime(false);
    setShowSummaryModal(true);
  };

  // Reconstruct route and snap all straight-line segments to real pedestrian sidewalks and streets
  const handleSnapRouteToStreets = async () => {
    if (isSnappingStreets || routePoints.length < 2) return;
    setIsSnappingStreets(true);
    try {
      const result = await snapRouteToPedestrianStreets(routePoints);
      if (result.snappedSegmentsCount > 0) {
        setRoutePoints(result.snappedPoints);
        setDistanceKm(result.totalDistanceKm);
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(result.snappedPoints.map((p) => [p.lat, p.lng]));
        }
        syncToLocalStorage(isRunning, isPaused, result.totalDistanceKm, result.snappedPoints);
        setSnapNotification(
          `Route snapped to sidewalks: +${result.distanceDifferenceKm.toFixed(2)} km added (${result.totalDistanceKm.toFixed(2)} km total)`
        );
        setTimeout(() => setSnapNotification(null), 6000);
      } else {
        setSnapNotification('Route already follows streets accurately');
        setTimeout(() => setSnapNotification(null), 4000);
      }
    } catch (err) {
      console.warn('Snap route failed:', err);
    } finally {
      setIsSnappingStreets(false);
    }
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
    syncToLocalStorage(false, false, 0, []);
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

  // Open Edit modal for existing logged session
  const handleStartEditJog = (jog: JogSession) => {
    setEditingJog(jog);
    setEditDurationMins(Math.floor(jog.durationSeconds / 60));
    setEditDurationSecs(jog.durationSeconds % 60);
    setEditDistanceKm(jog.distanceKm);
    setEditActivityType(jog.activityType || 'fast_walk');
  };

  // Save edited session
  const handleSaveEditedJog = () => {
    if (!editingJog || !onUpdateJog) return;
    const totalSecs = Math.max(1, editDurationMins * 60 + editDurationSecs);
    const dist = Math.max(0.01, editDistanceKm);
    const pace = dist > 0.05 ? (totalSecs / 60) / dist : 0;
    const cals = calculateCalories(dist, totalSecs, editActivityType);

    const updated: JogSession = {
      ...editingJog,
      activityType: editActivityType,
      durationSeconds: totalSecs,
      distanceKm: Number(dist.toFixed(3)),
      caloriesBurned: cals,
      avgPaceMinPerKm: Number(pace.toFixed(2))
    };

    onUpdateJog(updated);
    setEditingJog(null);
  };

  return (
    <div className="space-y-6" id="jog-tracker-root">
      {/* Header Navigation & Activity Type Selector */}
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
                {activityType === 'fast_walk' ? 'Outdoor Walk & GPS' : 'Outdoor Jog & GPS'}
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {formatDateDDMMYYYY(selectedDate)}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live distance tracking, GPS route mapping, and wall-clock calorie calculation.
            </p>
          </div>
        </div>

        {/* Activity Type Switcher & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {!isRunning && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActivityType('fast_walk');
                  localStorage.setItem('preferred_cardio_activity', 'fast_walk');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activityType === 'fast_walk'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Footprints className="w-4 h-4" />
                <span>Fast Walk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivityType('jog');
                  localStorage.setItem('preferred_cardio_activity', 'jog');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activityType === 'jog'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>Outdoor Jog</span>
              </button>
            </div>
          )}

          {/* Simulation Toggle */}
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
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center text-center gap-1.5 ${
              isSimulating
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Toggle simulated movement for testing without moving"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSimulating ? 'Simulating' : 'Simulate'}
          </button>

          {/* GPS Signal Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${
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
                ? 'GPS Active'
                : gpsStatus === 'simulated'
                ? 'Demo GPS'
                : gpsStatus === 'acquiring'
                ? 'Acquiring GPS'
                : 'GPS Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Rest Day Recovery Banner */}
      {isRestDay && (
        <div className="flex items-start sm:items-center gap-3.5 bg-amber-50/90 border border-amber-250 p-4.5 rounded-2xl text-sm text-amber-950 shadow-xs">
          <Coffee className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-black text-sm text-amber-950 block">Scheduled Rest Day Active</span>
            <p className="text-amber-900 text-sm font-medium mt-0.5 leading-relaxed">
              Today is dedicated to full muscular and central nervous system recovery. Outdoor walk and jog logging is disabled for rest days.
            </p>
          </div>
        </div>
      )}

      {/* Top Live HUD Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Distance */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Distance</span>
            <Footprints className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
              {distanceKm.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-500">km</span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            ≈ {(distanceKm * 0.621371).toFixed(2)} miles
          </div>
        </div>

        {/* Metric 2: Calories Burned */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Burned</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-amber-600 tracking-tight font-mono">
              {caloriesBurned}
            </span>
            <span className="text-xs font-bold text-slate-500">kcal</span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {activityType === 'fast_walk' ? 'Brisk walk formula' : 'Jogging formula'} &bull; {Math.round(userWeightKg)} kg
          </div>
        </div>

        {/* Metric 3: Wall-Clock Duration */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Duration</span>
            <Timer className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
              {formatDuration(durationSeconds)}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {isRunning ? (isPaused ? 'Session Paused' : 'Wall-Clock Active') : 'Ready to start'}
          </div>
        </div>

        {/* Metric 4: Pace / Speed */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Avg Pace</span>
            <Gauge className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight font-mono">
              {formatPace(avgPaceMinPerKm)}
            </span>
            <span className="text-xs font-bold text-slate-500">/km</span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Speed: {currentSpeedKmH.toFixed(1)} km/h
          </div>
        </div>
      </div>

      {/* Interactive GPS Map View */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
              Live GPS Route Map
            </span>
            {routePoints.length > 0 && (
              <span className="text-sm font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md">
                {routePoints.length} Waypoints
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasStraightGaps && (
              <button
                type="button"
                onClick={handleSnapRouteToStreets}
                disabled={isSnappingStreets}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                title="Recalculate path along street sidewalks"
              >
                <Route className={`w-4 h-4 text-indigo-600 ${isSnappingStreets ? 'animate-spin' : ''}`} />
                {isSnappingStreets ? 'Snapping...' : 'Snap to Streets'}
              </button>
            )}
            <button
              type="button"
              onClick={handleRecenter}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              title="Center map on current GPS location"
            >
              <Navigation className="w-4 h-4 text-indigo-600" />
              Recenter
            </button>
          </div>
        </div>

        {/* Snap Notification Toast */}
        {snapNotification && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl text-sm font-semibold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{snapNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setSnapNotification(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Gap Warning Banner when a straight segment exists */}
        {hasStraightGaps && !snapNotification && (
          <div className="p-3.5 bg-sky-50 border border-sky-200 text-sky-950 rounded-2xl text-sm font-medium flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Route className="w-5 h-5 text-sky-600 shrink-0" />
              <span>Straight line gap detected. Snap route to sidewalks to calculate true street distance.</span>
            </div>
            <button
              type="button"
              onClick={handleSnapRouteToStreets}
              disabled={isSnappingStreets}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              {isSnappingStreets ? 'Snapping...' : 'Snap Now'}
            </button>
          </div>
        )}

        {/* Map Container Element */}
        <div className="relative w-full h-[380px] sm:h-[460px] rounded-2xl overflow-hidden border border-slate-200 z-0">
          <div ref={mapContainerRef} className="w-full h-full" id="leaflet-jog-map"></div>

          {/* Floating Overlay Badge on Map */}
          {isRunning && (
            <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-xs text-white px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2.5 z-500 pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <div className="text-xs font-extrabold font-mono">
                {distanceKm.toFixed(2)} KM &bull; {formatDuration(durationSeconds)}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar / Controls */}
        <div className="pt-3 flex flex-col gap-3.5 border-t border-slate-100 w-full">
          <div className="text-sm text-slate-500 font-medium text-center">
            {isRestDay ? (
              <span className="text-amber-800 font-bold flex items-center justify-center gap-1.5">
                <Coffee className="w-4 h-4 text-amber-600" />
                Scheduled Rest Day &bull; Cardio Tracking Disabled
              </span>
            ) : isRunning ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                {activityType === 'fast_walk' ? 'Walk in progress' : 'Jog in progress'} &bull; Tracking distance and wall-clock time
              </span>
            ) : existingJogs.length > 0 ? (
              <span className="text-slate-600 font-semibold">
                You have {existingJogs.length} logged workout for {formatDateDDMMYYYY(selectedDate)}.
              </span>
            ) : (
              <span>
                Press <strong>{activityType === 'fast_walk' ? 'Start Fast Walk' : 'Start Jog'}</strong> to begin tracking
              </span>
            )}
          </div>

          <div className="w-full">
            {isRestDay ? (
              <button
                type="button"
                disabled
                className="w-full py-4 bg-slate-100 border border-slate-200 text-slate-400 font-bold text-sm rounded-2xl cursor-not-allowed flex items-center justify-center text-center gap-2.5 select-none opacity-80"
                id="start-activity-disabled-rest-btn"
              >
                <Coffee className="w-5 h-5 text-amber-600" />
                <span>Rest Day Active &bull; Cardio Logging Disabled</span>
              </button>
            ) : !isRunning ? (
              <button
                type="button"
                onClick={handleStartActivity}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-150 cursor-pointer flex items-center justify-center text-center gap-2.5"
                id="start-activity-main-btn"
              >
                <Play className="w-5 h-5 fill-current" />
                {activityType === 'fast_walk' ? 'Start Fast Walk' : 'Start Jog'}
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
                  onClick={handleStopActivity}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-md shadow-rose-200 cursor-pointer flex items-center justify-center text-center gap-2.5"
                  id="stop-activity-main-btn"
                >
                  <Square className="w-4 h-4 fill-current" />
                  {activityType === 'fast_walk' ? 'Stop Walk' : 'Stop Jog'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Previous Recorded Sessions for this Date */}
      {existingJogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800">
                Logged Cardio for {formatDateDDMMYYYY(selectedDate)}
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 font-mono">
                        {jog.distanceKm.toFixed(2)} km
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {jog.activityType === 'fast_walk' ? 'Fast Walk' : 'Outdoor Jog'}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 flex items-center gap-2 mt-1">
                      <span className="font-mono font-semibold">{formatDuration(jog.durationSeconds)}</span>
                      <span>&bull;</span>
                      <span className="text-amber-600 font-bold">{jog.caloriesBurned} kcal</span>
                      {jog.avgPaceMinPerKm ? (
                        <>
                          <span>&bull;</span>
                          <span className="font-mono">{formatPace(jog.avgPaceMinPerKm)}/km</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onUpdateJog && (
                    <button
                      type="button"
                      onClick={() => handleStartEditJog(jog)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                      title="Edit duration or details"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteJog && (
                    <button
                      type="button"
                      onClick={() => onDeleteJog(jog.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Summary Modal */}
      {showSummaryModal && completedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-scaleIn">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                {completedSession.activityType === 'fast_walk' ? 'Walk Finished' : 'Jog Finished'}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Cardio workout summary for {formatDateDDMMYYYY(selectedDate)}
              </p>
            </div>

            {/* Snap route to streets banner if gaps detected */}
            {completedSession.route && detectStraightLineGaps(completedSession.route, 0.04) && (
              <div className="p-3.5 bg-sky-50 border border-sky-200 text-sky-950 rounded-2xl text-sm font-medium flex flex-wrap items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Straight line gap detected. Snap path to sidewalks?</span>
                </div>
                <button
                  type="button"
                  disabled={isSnappingStreets}
                  onClick={async () => {
                    if (!completedSession.route) return;
                    setIsSnappingStreets(true);
                    try {
                      const res = await snapRouteToPedestrianStreets(completedSession.route);
                      const newDist = res.totalDistanceKm;
                      const newPace =
                        newDist > 0.05
                          ? completedSession.durationSeconds / 60 / newDist
                          : 0;
                      const newCals = calculateCalories(
                        newDist,
                        completedSession.durationSeconds,
                        completedSession.activityType || 'fast_walk'
                      );
                      setCompletedSession({
                        ...completedSession,
                        distanceKm: newDist,
                        avgPaceMinPerKm: Number(newPace.toFixed(2)),
                        caloriesBurned: newCals,
                        route: res.snappedPoints
                      });
                      setDistanceKm(newDist);
                      setRoutePoints(res.snappedPoints);
                      if (polylineRef.current) {
                        polylineRef.current.setLatLngs(res.snappedPoints.map((p) => [p.lat, p.lng]));
                      }
                    } catch (e) {
                      console.warn('Modal snap error:', e);
                    } finally {
                      setIsSnappingStreets(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  {isSnappingStreets ? 'Snapping...' : 'Snap to Streets'}
                </button>
              </div>
            )}

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-indigo-50/70 border border-indigo-150 rounded-2xl text-center space-y-0.5">
                <span className="text-xs font-black uppercase text-indigo-900 tracking-wider">
                  Total Distance
                </span>
                <div className="text-2xl font-black text-indigo-950 font-mono">
                  {completedSession.distanceKm.toFixed(2)} <span className="text-xs">KM</span>
                </div>
                <span className="text-xs text-indigo-600 font-medium">
                  {(completedSession.distanceKm * 0.621371).toFixed(2)} miles
                </span>
              </div>

              <div className="p-4 bg-amber-50/70 border border-amber-150 rounded-2xl text-center space-y-0.5">
                <span className="text-xs font-black uppercase text-amber-900 tracking-wider">
                  Calories Burnt
                </span>
                <div className="text-2xl font-black text-amber-950 font-mono">
                  {completedSession.caloriesBurned} <span className="text-xs">kcal</span>
                </div>
                <span className="text-xs text-amber-700 font-medium">
                  Energy expenditure
                </span>
              </div>

              <div className="p-4 bg-sky-50/70 border border-sky-150 rounded-2xl text-center space-y-1">
                <span className="text-xs font-black uppercase text-sky-900 tracking-wider">
                  Total Duration
                </span>
                {!isAdjustingSummaryTime ? (
                  <>
                    <div className="text-2xl font-black text-sky-950 font-mono">
                      {formatDuration(completedSession.durationSeconds)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdjustingSummaryTime(true)}
                      className="text-xs font-bold text-sky-700 hover:text-sky-950 underline cursor-pointer"
                    >
                      Adjust Time
                    </button>
                  </>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-center gap-1.5 font-mono">
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={manualDurationMins}
                          onChange={(e) => {
                            const mins = Math.max(0, parseInt(e.target.value) || 0);
                            setManualDurationMins(mins);
                            const newTotalSecs = mins * 60 + manualDurationSecs;
                            const newPace =
                              completedSession.distanceKm > 0.05
                                ? (newTotalSecs / 60) / completedSession.distanceKm
                                : 0;
                            const newCals = calculateCalories(
                              completedSession.distanceKm,
                              newTotalSecs,
                              completedSession.activityType || 'fast_walk'
                            );
                            setCompletedSession((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    durationSeconds: Math.max(1, newTotalSecs),
                                    avgPaceMinPerKm: Number(newPace.toFixed(2)),
                                    caloriesBurned: newCals
                                  }
                                : null
                            );
                          }}
                          className="w-16 px-2 py-1 bg-white border border-sky-300 rounded-lg text-center font-bold text-sm text-slate-800"
                        />
                        <span className="text-xs text-sky-700 font-semibold mt-0.5">mins</span>
                      </div>
                      <span className="font-bold text-sky-900">:</span>
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={manualDurationSecs}
                          onChange={(e) => {
                            const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setManualDurationSecs(secs);
                            const newTotalSecs = manualDurationMins * 60 + secs;
                            const newPace =
                              completedSession.distanceKm > 0.05
                                ? (newTotalSecs / 60) / completedSession.distanceKm
                                : 0;
                            const newCals = calculateCalories(
                              completedSession.distanceKm,
                              newTotalSecs,
                              completedSession.activityType || 'fast_walk'
                            );
                            setCompletedSession((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    durationSeconds: Math.max(1, newTotalSecs),
                                    avgPaceMinPerKm: Number(newPace.toFixed(2)),
                                    caloriesBurned: newCals
                                  }
                                : null
                            );
                          }}
                          className="w-16 px-2 py-1 bg-white border border-sky-300 rounded-lg text-center font-bold text-sm text-slate-800"
                        />
                        <span className="text-xs text-sky-700 font-semibold mt-0.5">secs</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdjustingSummaryTime(false)}
                      className="text-xs font-bold bg-sky-100 hover:bg-sky-200 text-sky-800 px-2.5 py-1 rounded cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-150 rounded-2xl text-center space-y-0.5">
                <span className="text-xs font-black uppercase text-emerald-900 tracking-wider">
                  Average Pace
                </span>
                <div className="text-2xl font-black text-emerald-950 font-mono">
                  {formatPace(completedSession.avgPaceMinPerKm || 0)}
                </div>
                <span className="text-xs text-emerald-700 font-medium">
                  min per kilometer
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full">
              <button
                type="button"
                onClick={() => setShowDiscardConfirmModal(true)}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
                id="discard-jog-summary-btn"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveJog}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-indigo-200 cursor-pointer flex items-center justify-center text-center gap-2"
                id="save-jog-summary-btn"
              >
                <CheckCircle2 className="w-4 h-4" />
                {completedSession.activityType === 'fast_walk' ? 'Save Walk to Records' : 'Save Jog to Records'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Past Log Modal */}
      {editingJog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Footprints className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Edit Workout Session
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingJog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Activity Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Activity Type
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditActivityType('fast_walk')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      editActivityType === 'fast_walk'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Fast Walk
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditActivityType('jog')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      editActivityType === 'jog'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Outdoor Jog
                  </button>
                </div>
              </div>

              {/* Distance Field */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Distance in km
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={editDistanceKm}
                  onChange={(e) => setEditDistanceKm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                {editingJog.route && detectStraightLineGaps(editingJog.route, 0.04) && (
                  <button
                    type="button"
                    disabled={isSnappingStreets}
                    onClick={async () => {
                      if (!editingJog.route) return;
                      setIsSnappingStreets(true);
                      try {
                        const res = await snapRouteToPedestrianStreets(editingJog.route);
                        setEditDistanceKm(res.totalDistanceKm);
                        setEditingJog({
                          ...editingJog,
                          distanceKm: res.totalDistanceKm,
                          route: res.snappedPoints
                        });
                      } catch (err) {
                        console.warn('Edit snap error:', err);
                      } finally {
                        setIsSnappingStreets(false);
                      }
                    }}
                    className="mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Route className="w-4 h-4" />
                    {isSnappingStreets ? 'Snapping to Sidewalks...' : 'Snap Route to Sidewalks'}
                  </button>
                )}
              </div>

              {/* Duration Fields */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Actual Duration
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={editDurationMins}
                      onChange={(e) => setEditDurationMins(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="block text-xs text-slate-400 font-semibold mt-1">Minutes</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editDurationSecs}
                      onChange={(e) => setEditDurationSecs(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="block text-xs text-slate-400 font-semibold mt-1">Seconds</span>
                  </div>
                </div>
              </div>

              {/* Calculated Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase">Estimated Burn</span>
                  <p className="font-mono font-black text-amber-600 text-sm">
                    {calculateCalories(editDistanceKm, editDurationMins * 60 + editDurationSecs, editActivityType)} kcal
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase">Calculated Pace</span>
                  <p className="font-mono font-black text-emerald-600 text-sm">
                    {formatPace(editDistanceKm > 0.05 ? ((editDurationMins * 60 + editDurationSecs) / 60) / editDistanceKm : 0)}/km
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingJog(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedJog}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-indigo-150 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal Before Discarding Completed Session */}
      <ConfirmModal
        isOpen={showDiscardConfirmModal}
        title="Discard Workout Session?"
        message="Are you sure you want to discard this session? All recorded distance, duration, and GPS route data for this session will be permanently cleared."
        confirmText="Yes, Discard"
        cancelText="Keep Session"
        variant="danger"
        zIndex="z-[70]"
        onConfirm={() => {
          setShowDiscardConfirmModal(false);
          handleDiscardJog();
        }}
        onCancel={() => setShowDiscardConfirmModal(false)}
      />
    </div>
  );
}
