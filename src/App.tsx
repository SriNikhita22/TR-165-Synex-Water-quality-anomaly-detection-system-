import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Droplets, 
  AlertTriangle, 
  Activity, 
  Map as MapIcon, 
  ShieldCheck, 
  Info,
  RefreshCw,
  TrendingUp,
  Thermometer,
  Wind,
  Zap,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Wrench,
  ShieldAlert,
  User,
  Settings as SettingsIcon
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useTheme } from './components/ThemeProvider';
import { SensorData, Alert, THRESHOLDS } from './types';
import { GoogleGenAI } from "@google/genai";
import { db, firebaseConfig } from './lib/firebase';
import { seedDatabase } from './lib/seedData';
const useAuth = () => ({
  user: { email: 'guest@hydroguard.io', uid: 'guest' },
  profile: { displayName: 'Guest User', role: 'ADMIN' },
  loading: false,
  logout: () => console.log('Bypassed'),
  logAction: async (type: string, details: string, id?: string) => {
    console.log('Action logged:', { type, details, id });
  }
});
// import ProtectedRoute from './context/ProtectedRoute';
const ProtectedRoute = ({ children }: any) => <>{children}</>;
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { ChevronRight } from 'lucide-react';
import PredictiveChart from './components/PredictiveChart';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, logout, logAction } = useAuth();
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'dashboard' | 'sensors' | 'alerts' | 'analytics' | 'settings' | 'thresholds' | 'api'>('dashboard');
  const [lastDataTimestamp, setLastDataTimestamp] = useState<number>(Date.now());
  const [latency, setLatency] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'operator' | 'public'>('operator');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{ 
    lat: number, 
    lng: number, 
    status: string,
    ph?: number,
    turbidity?: number,
    tds?: number,
    chlorine?: number,
    confidence?: 'LOW' | 'MEDIUM' | 'HIGH',
    sensorCount?: number
  } | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [firestoreSensors, setFirestoreSensors] = useState<any[]>([]);
  const [firestoreAlerts, setFirestoreAlerts] = useState<any[]>([]);
  const hasInitializedMap = useRef(false);

  // Seed data on mount
  useEffect(() => {
    seedDatabase();
  }, []);

  // Fetch from Firestore
  useEffect(() => {
    const sensorsRef = collection(db, 'sensors');
    const unsubscribeSensors = onSnapshot(sensorsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirestoreSensors(data);
    });

    const alertsRef = collection(db, 'alerts');
    const qAlerts = query(alertsRef, orderBy('timestamp', 'desc'));
    const unsubscribeAlerts = onSnapshot(qAlerts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirestoreAlerts(data);
    });

    return () => {
      unsubscribeSensors();
      unsubscribeAlerts();
    };
  }, []);

  // Remove local firebase logic, using AuthContext version if needed
  // ... existing simulation logic ...

  const getRecommendation = (type: string, severity: string) => {
    const ctype = type.toLowerCase();
    const sev = severity.toUpperCase();
    let actions: string[] = [];
    let notes = "";
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (ctype === 'chemical') {
      actions = ["Flush pipelines", "Isolate affected zone", "Adjust pH levels"];
      notes = "Chemical imbalance detected. Potential industrial runoff.";
    } else if (ctype === 'biological') {
      actions = ["Increase chlorination", "Issue boil water advisory", "Inspect microbial sources"];
      notes = "Pathogen risk detected. Chlorine levels insufficient.";
    } else if (ctype === 'physical') {
      actions = ["Activate filtration systems", "Check pipeline damage", "Remove suspended particles"];
      notes = "High suspended solids. Likely pipeline breach.";
    } else {
      actions = ["Increase sampling frequency", "Verify sensor calibration"];
      notes = "Anomaly detected without clear signature.";
    }

    if (sev === 'CRITICAL' || sev === 'HIGH') {
      priority = 'HIGH';
      actions.unshift("EMERGENCY SHUTDOWN of local grid");
    } else if (sev === 'MEDIUM') {
      priority = 'MEDIUM';
      actions.unshift("Notify Grid Operators");
    }

    return { actions, notes, priority };
  };

  // Fetch and Simulate Data
  useEffect(() => {
    const initialSensors: SensorData[] = [
      { id: 'SN-001', sensorId: 'SN-001', location: { lat: 28.6139, lng: 77.2090, name: 'Delhi Hub' }, metrics: { ph: 7.2, turbidity: 2.1, tds: 210, chlorine: 0.8 }, timestamp: Date.now() },
      { id: 'SN-002', sensorId: 'SN-002', location: { lat: 19.0760, lng: 72.8777, name: 'Mumbai Hub' }, metrics: { ph: 7.1, turbidity: 1.8, tds: 190, chlorine: 0.9 }, timestamp: Date.now() },
      { id: 'SN-003', sensorId: 'SN-003', location: { lat: 13.0827, lng: 80.2707, name: 'Chennai Hub' }, metrics: { ph: 7.4, turbidity: 2.5, tds: 250, chlorine: 0.7 }, timestamp: Date.now() },
      { id: 'SN-004', sensorId: 'SN-004', location: { lat: 51.5074, lng: -0.1278, name: 'London Hub' }, metrics: { ph: 7.0, turbidity: 1.5, tds: 180, chlorine: 1.0 }, timestamp: Date.now() },
      { id: 'SN-005', sensorId: 'SN-005', location: { lat: 40.7128, lng: -74.0060, name: 'New York Hub' }, metrics: { ph: 7.3, turbidity: 1.2, tds: 150, chlorine: 1.2 }, timestamp: Date.now() }
    ];

    setSensorData(initialSensors);

    // 1. Listen for real-time sensor updates (Local Simulation Fallback)
    const simulationInterval = setInterval(() => {
      const startTime = performance.now();
      
      setSensorData(prev => {
        const newData = prev.map(s => {
          const isAnomaly = Math.random() > 0.95; // 5% chance of anomaly
          const metrics = {
            ph: isAnomaly ? (Math.random() > 0.5 ? 9.2 : 5.8) : 6.5 + Math.random() * 2.0, // 6.5 - 8.5
            turbidity: isAnomaly ? 12.5 + Math.random() * 5 : Math.random() * 5.0, // 0 - 5 (normal)
            tds: 50 + Math.random() * 550, // 50 - 600
            chlorine: isAnomaly ? 0.05 : 0.2 + Math.random() * 1.3 // 0.2 - 1.5
          };

          // Check for alerts locally
          if (metrics.ph < THRESHOLDS.PH.min || metrics.ph > THRESHOLDS.PH.max || metrics.turbidity > THRESHOLDS.TURBIDITY.max) {
            const type = metrics.turbidity > 10 ? 'PHYSICAL' : metrics.chlorine < 0.1 ? 'BIOLOGICAL' : 'CHEMICAL';
            const severity = metrics.turbidity > 15 || metrics.ph < 5 ? 'CRITICAL' : 'HIGH';
            const { actions, notes, priority } = getRecommendation(type, severity);

            const newAlert: Alert = {
              id: `${s.sensorId}_${Date.now()}`,
              sensorId: s.sensorId,
              timestamp: Date.now(),
              type,
              severity,
              priority,
              message: `Anomaly detected at ${s.location.name}: ${metrics.ph < THRESHOLDS.PH.min ? 'Low pH' : metrics.ph > THRESHOLDS.PH.max ? 'High pH' : 'High Turbidity'}`,
              metrics,
              actions,
              notes
            };

            setAlerts(prevAlerts => {
              const exists = prevAlerts.some(a => a.sensorId === s.sensorId && Date.now() - a.timestamp < 30000);
              if (exists) return prevAlerts;
              return [newAlert, ...prevAlerts].slice(0, 10);
            });
          }

          return { ...s, metrics, timestamp: Date.now() };
        });

        // Update history for charts
        setHistory(prevHistory => {
          const newPoint = {
            time: new Date().toLocaleTimeString(),
            ...newData.reduce((acc: any, s: any) => {
              acc[`${s.sensorId}_ph`] = s.metrics.ph;
              acc[`${s.sensorId}_turbidity`] = s.metrics.turbidity;
              return acc;
            }, {})
          };
          return [...prevHistory.slice(-20), newPoint];
        });

        return newData;
      });

      setLastDataTimestamp(Date.now());
      setLatency(Math.round(performance.now() - startTime));
    }, 3000);

    // 2. Firebase Listeners (Optional if config exists)
    let unsubscribeSensors: () => void = () => {};
    let unsubscribeAlerts: () => void = () => {};

    if (firebaseConfig.apiKey !== "demo-key") {
      const q = query(collection(db, 'sensors'), orderBy('timestamp', 'desc'), limit(10));
      unsubscribeSensors = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        if (data.length > 0) setSensorData(data);
      });

      const alertsQ = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(10));
      unsubscribeAlerts = onSnapshot(alertsQ, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Alert[];
        setAlerts(data);
      });
    }

    return () => {
      unsubscribeSensors();
      unsubscribeAlerts();
      clearInterval(simulationInterval);
    };
  }, [db]);

  const analyzeContamination = async (alert: Alert) => {
    setIsAnalyzing(true);
    setAiInsight(null);
    try {
      const prompt = `Analyze this water contamination event:
      Metrics: pH: ${alert.metrics.ph}, Turbidity: ${alert.metrics.turbidity} NTU, TDS: ${alert.metrics.tds} mg/L, Chlorine: ${alert.metrics.chlorine} mg/L.
      Thresholds: pH (6.5-8.5), Turbidity (<5), TDS (<500), Chlorine (0.2-2.0).
      
      Provide:
      1. Classification (Chemical, Biological, or Physical)
      2. Severity Assessment
      3. Estimated impact radius (in meters)
      4. Immediate action recommendations.
      
      Format as a concise summary with clear headings.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiInsight(result.text || "Analysis unavailable.");
    } catch (err) {
      console.error("AI Analysis failed", err);
      setAiInsight("AI Analysis failed. Please check connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uniqueLocations = useMemo(() => {
    const locations = sensorData.map(s => s.location.name);
    return Array.from(new Set(locations));
  }, [sensorData]);

  const filteredSensors = useMemo(() => {
    if (!locationFilter) return sensorData;
    return sensorData.filter(s => s.location.name === locationFilter);
  }, [sensorData, locationFilter]);

  const activeSensor = useMemo(() => {
    const pool = locationFilter ? filteredSensors : sensorData;
    return pool.find(s => s.sensorId === selectedSensor) || pool[0] || sensorData[0];
  }, [sensorData, filteredSensors, selectedSensor, locationFilter]);

  function MapBoundsHandler() {
    const map = useMap();
    useEffect(() => {
      if (filteredSensors.length > 0 && !hasInitializedMap.current) {
        const bounds = L.latLngBounds(filteredSensors.map(s => [s.location.lat, s.location.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        hasInitializedMap.current = true;
      }
    }, [filteredSensors, map]);
    return null;
  }

  function AnomalySpread({ center, sensorId }: { center: [number, number], sensorId: string }) {
    const [radius, setRadius] = useState(50);
    const [opacity, setOpacity] = useState(0.3);
    
    useEffect(() => {
      let frame: number;
      let start: number;
      
      const animate = (time: number) => {
        if (!start) start = time;
        const progress = (time - start) % 3000; // 3 second loop
        const factor = progress / 3000;
        
        setRadius(50 + factor * 950); // 50m to 1000m
        setOpacity(0.3 * (1 - factor)); // Fade out
        
        frame = requestAnimationFrame(animate);
      };
      
      frame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frame);
    }, []);

    return (
      <Circle 
        center={center}
        radius={radius}
        pathOptions={{ 
          color: '#FF4D4F',
          fillColor: '#FF4D4F',
          fillOpacity: opacity,
          weight: 1,
          dashArray: '5, 5'
        }}
      >
        <Popup>
          <div className="text-[10px] font-bold text-danger uppercase">Active Contamination Spread</div>
          <div className="text-[8px] text-text-dim">Sensor: {sensorId}</div>
        </Popup>
      </Circle>
    );
  }

  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        
        // Inverse Distance Weighting (IDW) for pH, Turbidity, TDS, Chlorine
        const radius = 0.5; // Larger radius for global view
        const nearbySensors = sensorData.filter(s => {
          const dist = Math.sqrt(Math.pow(s.location.lat - lat, 2) + Math.pow(s.location.lng - lng, 2));
          return dist < radius;
        });

        if (nearbySensors.length === 0) {
          setClickedLocation({
            lat,
            lng,
            status: 'NO SENSORS IN RANGE • UNABLE TO PREDICT',
            confidence: 'LOW',
            sensorCount: 0
          });
          return;
        }

        let totalWeight = 0;
        let weightedPh = 0;
        let weightedTurbidity = 0;
        let weightedTds = 0;
        let weightedChlorine = 0;

        nearbySensors.forEach(s => {
          const dist = Math.sqrt(Math.pow(s.location.lat - lat, 2) + Math.pow(s.location.lng - lng, 2));
          const weight = 1 / (Math.pow(dist, 2) + 0.00001); // Squared distance for sharper local influence
          totalWeight += weight;
          weightedPh += s.metrics.ph * weight;
          weightedTurbidity += s.metrics.turbidity * weight;
          weightedTds += s.metrics.tds * weight;
          weightedChlorine += s.metrics.chlorine * weight;
        });

        const estPh = weightedPh / totalWeight;
        const estTurbidity = weightedTurbidity / totalWeight;
        const estTds = weightedTds / totalWeight;
        const estChlorine = weightedChlorine / totalWeight;
        
        const isAnomaly = estPh < THRESHOLDS.PH.min || estPh > THRESHOLDS.PH.max || estTurbidity > THRESHOLDS.TURBIDITY.max;
        
        let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (nearbySensors.length >= 3) confidence = 'HIGH';
        else if (nearbySensors.length >= 2) confidence = 'MEDIUM';

        setClickedLocation({
          lat,
          lng,
          status: isAnomaly ? 'POTENTIAL CONTAMINATION DETECTED' : 'CLEAR • NO ANOMALIES DETECTED',
          ph: estPh,
          turbidity: estTurbidity,
          tds: estTds,
          chlorine: estChlorine,
          confidence,
          sensorCount: nearbySensors.length
        });
      },
    });
    return null;
  }

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-accent/30 flex flex-col">
      {/* Error Banner */}
      {dbError && (
        <div className="bg-danger text-white text-center py-1 text-[10px] font-bold animate-pulse z-[60]">
          {dbError}
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-lg shadow-accent/20">
            <Droplets className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">HydroGuard</h1>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                Date.now() - lastDataTimestamp < 10000 ? "bg-success" : "bg-danger"
              )} />
              <span className="text-[10px] text-text-dim uppercase tracking-wider font-medium">
                {Date.now() - lastDataTimestamp < 10000 ? "SYSTEM LIVE • GLOBAL MONITORING SYSTEM" : "SYSTEM OFFLINE • CHECK CONNECTION"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 font-mono text-[10px] tracking-wider">
          <div className="flex items-center gap-2">
            <span className={Date.now() - lastDataTimestamp < 10000 ? "text-success" : "text-danger"}>●</span> 
            STREAM: {Date.now() - lastDataTimestamp < 10000 ? "ACTIVE" : "INACTIVE"}
          </div>
          <div className="text-text-dim uppercase">LATENCY: {latency}ms</div>
          <div className="text-text-dim uppercase">NODES: {sensorData.length}/128</div>
          <div className="flex items-center bg-bg border border-border rounded-full p-0.5 ml-2">
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
              <button 
                onClick={() => setViewMode('operator')}
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'operator' ? "bg-accent text-bg" : "text-text-dim hover:text-text-main"
                )}
              >
                <SettingsIcon className="w-3 h-3" /> OPERATOR
              </button>
            </ProtectedRoute>
            <button 
              onClick={() => setViewMode('public')}
              className={cn(
                "px-3 py-1 rounded-full text-[9px] font-bold transition-all flex items-center gap-1.5",
                viewMode === 'public' ? "bg-accent text-bg" : "text-text-dim hover:text-text-main"
              )}
            >
              <User className="w-3 h-3" /> PUBLIC
            </button>
          </div>

          <div className="h-8 w-px bg-border mx-2" />

          <button 
            className="p-1.5 hover:bg-border rounded transition-all flex items-center justify-center ml-2" 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4 text-text-dim" /> : <Sun className="w-4 h-4 text-text-dim" />}
          </button>
          <button className="p-1.5 hover:bg-border rounded transition-colors" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 text-text-dim" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-6 flex flex-col gap-8 hidden md:flex shadow-xl">
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--sidebar-text-dim)] mb-4 font-bold">Monitoring</div>
            <nav className="space-y-1">
              <SidebarItem 
                icon={<MapIcon className="w-4 h-4" />} 
                label="Real-time Map" 
                active={activePage === 'dashboard'} 
                onClick={() => setActivePage('dashboard')}
              />
              <SidebarItem 
                icon={<Activity className="w-4 h-4" />} 
                label="Sensor Network" 
                active={activePage === 'sensors'}
                onClick={() => setActivePage('sensors')}
              />
              <SidebarItem 
                icon={<AlertTriangle className="w-4 h-4" />} 
                label="Active Alerts" 
                active={activePage === 'alerts'}
                onClick={() => setActivePage('alerts')}
              />
              <SidebarItem 
                icon={<TrendingUp className="w-4 h-4" />} 
                label="Analytics Lab" 
                active={activePage === 'analytics'}
                onClick={() => setActivePage('analytics')}
              />
            </nav>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--sidebar-text-dim)] mb-4 font-bold">System</div>
            <nav className="space-y-1">
              <SidebarItem 
                icon={<ShieldCheck className="w-4 h-4" />} 
                label="Settings" 
                active={activePage === 'settings'}
                onClick={() => setActivePage('settings')}
              />
              <SidebarItem 
                icon={<Info className="w-4 h-4" />} 
                label="Thresholds (WHO)" 
                active={activePage === 'thresholds'}
                onClick={() => setActivePage('thresholds')}
              />
              <SidebarItem 
                icon={<Zap className="w-4 h-4" />} 
                label="API Documentation" 
                active={activePage === 'api'}
                onClick={() => setActivePage('api')}
              />
            </nav>
          </div>
          <div className="mt-auto">
            <div className="font-mono text-[9px] text-[var(--sidebar-text-dim)] border border-[var(--sidebar-border)] px-2 py-1 rounded inline-block">
              KAFKA • FLINK • TIMESCALE
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-bg/50 dark:bg-bg">
          <div className="max-w-6xl mx-auto space-y-6">
            {activePage === 'dashboard' && (
              <>
                {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                label="pH Level" 
                value={activeSensor?.metrics.ph.toFixed(2) || '--'} 
                meta={activeSensor?.metrics.ph < 6.5 || activeSensor?.metrics.ph > 8.5 ? 'OUTSIDE RANGE' : 'STABLE (BIS)'}
                status={activeSensor?.metrics.ph < 6.5 || activeSensor?.metrics.ph > 8.5 ? 'error' : 'success'}
              />
              <StatCard 
                label="Turbidity" 
                value={activeSensor?.metrics.turbidity.toFixed(1) || '--'} 
                unit="NTU"
                meta={activeSensor?.metrics.turbidity > 5 ? '↑ ABOVE LIMIT' : 'NORMAL'}
                status={activeSensor?.metrics.turbidity > 5 ? 'error' : 'success'}
              />
              <StatCard 
                label="TDS" 
                value={activeSensor?.metrics.tds.toFixed(0) || '--'} 
                unit="mg/L"
                meta={activeSensor?.metrics.tds > 500 ? 'HIGH CONTENT' : 'OPTIMAL'}
                status={activeSensor?.metrics.tds > 500 ? 'warning' : 'success'}
              />
              <StatCard 
                label="Chlorine" 
                value={activeSensor?.metrics.chlorine.toFixed(2) || '--'} 
                unit="mg/L"
                meta="NORMAL RANGE"
                status={activeSensor?.metrics.chlorine < 0.2 || activeSensor?.metrics.chlorine > 2.0 ? 'warning' : 'success'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map & Chart Section */}
              <div className="lg:col-span-2 space-y-6">
                {/* Map */}
                <div className={cn(
                  "border border-border rounded-xl overflow-hidden relative aspect-video transition-colors duration-500 bg-surface",
                  theme === 'dark' && "essential-highlight"
                )}>
                  <MapContainer 
                    center={[20, 0]} 
                    zoom={2} 
                    className="w-full h-full z-0"
                    zoomControl={true}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapBoundsHandler />
                    <MapClickHandler />
                    
                    {clickedLocation && (
                      <>
                        <Marker 
                          position={[clickedLocation.lat, clickedLocation.lng]}
                          icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div class="w-5 h-5 rounded-full border-2 border-white shadow-xl ${clickedLocation.status.includes('DETECTED') && !clickedLocation.status.includes('CLEAR') ? 'bg-danger animate-bounce' : 'bg-accent'}"></div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                          })}
                        >
                          <Popup onClose={() => setClickedLocation(null)}>
                            <div className="p-2 space-y-2 min-w-[200px]">
                              <div className="text-[10px] font-bold text-accent uppercase tracking-wider">Manual Probe Location</div>
                              <div className="text-[9px] font-mono text-text-dim">
                                LAT: {clickedLocation.lat.toFixed(6)}<br/>
                                LNG: {clickedLocation.lng.toFixed(6)}
                              </div>

                              {clickedLocation.sensorCount! > 0 && (
                                <div className="grid grid-cols-2 gap-2 py-2 border-y border-border">
                                  <div>
                                    <div className="text-[8px] text-text-dim uppercase">EST. pH</div>
                                    <div className="text-xs font-bold">{clickedLocation.ph?.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[8px] text-text-dim uppercase">EST. Turbidity</div>
                                    <div className="text-xs font-bold">{clickedLocation.turbidity?.toFixed(1)} NTU</div>
                                  </div>
                                  <div>
                                    <div className="text-[8px] text-text-dim uppercase">EST. TDS</div>
                                    <div className="text-xs font-bold">{clickedLocation.tds?.toFixed(0)} mg/L</div>
                                  </div>
                                  <div>
                                    <div className="text-[8px] text-text-dim uppercase">EST. Chlorine</div>
                                    <div className="text-xs font-bold">{clickedLocation.chlorine?.toFixed(2)} mg/L</div>
                                  </div>
                                </div>
                              )}

                              <div className={cn(
                                "text-[10px] font-bold p-1.5 rounded text-center",
                                clickedLocation.status.includes('DETECTED') && !clickedLocation.status.includes('CLEAR')
                                  ? "bg-danger/10 text-danger"
                                  : clickedLocation.status.includes('NO SENSORS')
                                    ? "bg-bg text-text-dim border border-border"
                                    : "bg-success/10 text-success"
                              )}>
                                {clickedLocation.status}
                              </div>

                              <div className="flex items-center justify-between text-[8px] text-text-dim uppercase font-bold">
                                <span>Confidence: {clickedLocation.confidence}</span>
                                <span>Sensors Used: {clickedLocation.sensorCount}</span>
                              </div>

                              <button 
                                onClick={() => setClickedLocation(null)}
                                className="w-full py-1 text-[9px] font-bold uppercase border border-border rounded hover:bg-bg transition-colors"
                              >
                                Clear Probe
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                        {clickedLocation.status.includes('DETECTED') && !clickedLocation.status.includes('CLEAR') && (
                          <Circle 
                            center={[clickedLocation.lat, clickedLocation.lng]}
                            radius={1200}
                            pathOptions={{ 
                              color: '#FF4D4F',
                              fillColor: '#FF4D4F',
                              fillOpacity: 0.1,
                              weight: 1,
                              dashArray: '10, 10'
                            }}
                          />
                        )}
                      </>
                    )}

                    {filteredSensors.map(s => {
                      const isAlert = alerts.some(a => a.sensorId === s.sensorId);
                      
                      return (
                        <React.Fragment key={s.sensorId}>
                          <Marker 
                            position={[s.location.lat, s.location.lng]} 
                            eventHandlers={{ click: () => setSelectedSensor(s.sensorId) }}
                            icon={L.divIcon({
                              className: 'custom-div-icon',
                              html: `<div class="w-4 h-4 rounded-full border-2 border-white shadow-lg ${isAlert ? 'bg-danger animate-pulse' : 'bg-accent'}"></div>`,
                              iconSize: [16, 16],
                              iconAnchor: [8, 8]
                            })}
                          >
                            <Popup>
                              <div className="p-2 space-y-1 min-w-[120px]">
                                <div className="font-bold text-sm text-text-main">{s.location.name}</div>
                                <div className="text-[10px] text-text-dim font-mono">NODE ID: {s.sensorId}</div>
                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border">
                                  <div>
                                    <div className="text-[8px] text-text-dim uppercase">pH</div>
                                    <div className="text-xs font-bold">{s.metrics.ph.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[8px] text-text-dim uppercase">Turbidity</div>
                                    <div className="text-xs font-bold">{s.metrics.turbidity.toFixed(1)}</div>
                                  </div>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                          {isAlert && (
                            <>
                              <Circle 
                                center={[s.location.lat, s.location.lng]}
                                radius={800}
                                pathOptions={{ 
                                  color: '#FF4D4F',
                                  fillColor: '#FF4D4F',
                                  fillOpacity: 0.15,
                                  weight: 2,
                                  dashArray: '5, 10'
                                }}
                              />
                              <AnomalySpread center={[s.location.lat, s.location.lng]} sensorId={s.sensorId} />
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </MapContainer>
                  
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <div className="bg-surface/90 backdrop-blur border border-border px-3 py-1.5 rounded text-[10px] font-mono text-text-dim shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full" /> NORMAL NODE
                    </div>
                    <div className="bg-surface/90 backdrop-blur border border-border px-3 py-1.5 rounded text-[10px] font-mono text-text-dim shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-danger rounded-full animate-pulse" /> ANOMALY DETECTED
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 z-10 bg-surface/80 backdrop-blur border border-border px-3 py-1.5 rounded text-[10px] font-mono text-text-dim shadow-sm">
                    {locationFilter ? `ZONE: ${locationFilter.toUpperCase()}` : 'GLOBAL MONITORING VIEW'}: {alerts.length > 0 ? `${alerts.length} ACTIVE ANOMALIES` : 'ALL CLEAR'}
                  </div>
                </div>

            <div className={cn(
              "bg-surface border border-border rounded-xl p-6 transition-all",
              theme === 'dark' && "essential-highlight"
            )}>
              <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-text-main flex items-center gap-2 uppercase tracking-wider">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      Quality Trends
                    </h3>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => setLocationFilter(null)}
                        className={cn(
                          "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                          locationFilter === null 
                            ? "bg-accent text-bg" 
                            : "bg-bg text-text-dim hover:text-text-main border border-border"
                        )}
                      >
                        ALL
                      </button>
                      {uniqueLocations.map(loc => (
                        <button 
                          key={loc}
                          onClick={() => setLocationFilter(loc)}
                          className={cn(
                            "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                            locationFilter === loc 
                              ? "bg-accent text-bg" 
                              : "bg-bg text-text-dim hover:text-text-main border border-border"
                          )}
                        >
                          {loc.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#58A6FF" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                        <XAxis dataKey="time" stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '4px', fontSize: '10px' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey={`${activeSensor?.sensorId}_ph`} 
                          stroke="#58A6FF" 
                          fillOpacity={1} 
                          fill="url(#colorPh)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Alerts Sidebar */}
              <div className="bg-surface border border-border rounded-xl flex flex-col h-[600px]">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Active Alerts</h3>
                  <span className="text-[9px] font-mono text-text-dim animate-pulse">LIVE</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {alerts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-dim p-8 text-center space-y-4">
                        <ShieldCheck className="w-10 h-10 opacity-20" />
                        <p className="text-xs font-medium">No anomalies detected in the current stream.</p>
                      </div>
                    ) : (
                      alerts.map(alert => (
                        <motion.div 
                          key={alert.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border-b border-border hover:bg-bg/50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                              alert.severity === 'CRITICAL' 
                                ? "bg-danger/10 text-danger border-danger/30" 
                                : "bg-warning/10 text-warning border-warning/30"
                            )}>
                              {alert.type} • {alert.severity}
                            </div>
                            <div className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                              alert.priority === 'HIGH' ? "border-danger text-danger" : "border-warning text-warning"
                            )}>
                              {alert.priority} PRIORITY
                            </div>
                          </div>
                          
                          <div className="text-sm font-bold mb-1 group-hover:text-accent transition-colors" onClick={() => analyzeContamination(alert)}>
                            {alert.message.split(':')[1] || alert.message}
                          </div>
                          
                          <div className="text-[10px] text-text-dim font-mono mb-3">
                            {alert.sensorId} • {new Date(alert.timestamp).toLocaleTimeString()}
                          </div>

                          {viewMode === 'operator' ? (
                            <div className="space-y-2">
                              <button 
                                onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                                className="flex items-center gap-2 text-[10px] font-bold text-accent hover:underline"
                              >
                                {expandedAlert === alert.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {expandedAlert === alert.id ? 'HIDE ACTIONS' : 'VIEW RECOMMENDED ACTIONS'}
                              </button>
                              
                              <AnimatePresence>
                                {expandedAlert === alert.id && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="bg-bg/50 rounded-lg p-3 border border-border space-y-2">
                                      {alert.actions.map((action, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10px]">
                                          {i === 0 ? <ShieldAlert className="w-3 h-3 text-danger shrink-0 mt-0.5" /> : <Wrench className="w-3 h-3 text-accent shrink-0 mt-0.5" />}
                                          <span className={i === 0 ? "font-bold text-danger" : "text-text-main"}>{action}</span>
                                        </div>
                                      ))}
                                      {alert.notes && (
                                        <div className="mt-2 pt-2 border-t border-border text-[9px] text-text-dim italic">
                                          Note: {alert.notes}
                                        </div>
                                      )}
                                      
                                      <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setAlerts(prev => prev.filter(a => a.id !== alert.id));
                                            logAction('ALERT_ACKNOWLEDGED', `Alert acknowledged for sensor ${alert.sensorId}`, alert.id);
                                          }}
                                          className="w-full mt-3 bg-accent text-bg py-2 rounded text-[10px] font-bold hover:opacity-90 transition-all uppercase flex items-center justify-center gap-2 group"
                                        >
                                          Acknowledge & Resolve Case <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                      </ProtectedRoute>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div className="bg-danger/5 border border-danger/20 rounded p-2 text-[10px] font-bold text-danger flex items-center gap-2">
                              <AlertTriangle className="w-3 h-3" />
                              PUBLIC NOTICE: {alert.type === 'BIOLOGICAL' ? 'BOIL WATER ADVISORY' : 'WATER QUALITY ANOMALY - USE CAUTION'}
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Action Panel */}
            <section className={cn(
              "bg-accent/5 border border-accent rounded-lg p-4 flex flex-col md:flex-row items-center gap-6 transition-all",
              theme === 'dark' && "essential-highlight"
            )}>
              <div className="bg-accent text-bg px-3 py-1 rounded font-extrabold text-[10px] tracking-wider whitespace-nowrap">
                RECOMMENDED ACTION
              </div>
              <div className="text-xs flex-grow text-center md:text-left leading-relaxed">
                {isAnalyzing ? (
                  <span className="animate-pulse text-accent">AI Engine processing contamination signature...</span>
                ) : aiInsight ? (
                  <div className="max-h-24 overflow-y-auto custom-scrollbar pr-4">
                    {aiInsight}
                  </div>
                ) : (
                  "Select an active alert to generate a high-confidence mitigation protocol using the Gemini AI core."
                )}
              </div>
              <button className="bg-accent hover:bg-accent/80 text-bg text-[11px] font-bold px-4 py-2 rounded transition-all whitespace-nowrap">
                Execute Protocol
              </button>
            </section>
              </>
            )}

            {activePage === 'sensors' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Sensor Network</h2>
                    <p className="text-xs text-text-dim">Monitoring {firestoreSensors.length} active nodes across the grid.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-text-dim">Status:</span>
                    <div className="flex gap-1.5">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-[9px] font-bold text-text-dim">Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-warning" />
                        <span className="text-[9px] font-bold text-text-dim">Warning</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-danger" />
                        <span className="text-[9px] font-bold text-text-dim">Critical</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {firestoreSensors.map((sensor) => (
                    <div key={sensor.id} className="bg-surface border border-border rounded-xl p-5 hover:border-accent/50 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                          <Activity size={20} />
                        </div>
                        <div className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          sensor.status === 'Active' ? "bg-success/10 text-success" :
                          sensor.status === 'Warning' ? "bg-warning/10 text-warning" :
                          "bg-danger/10 text-danger"
                        )}>
                          {sensor.status}
                        </div>
                      </div>
                      <div className="space-y-1 mb-4">
                        <h3 className="font-bold text-sm">{sensor.name}</h3>
                        <p className="text-[10px] text-text-dim flex items-center gap-1 uppercase tracking-tight">
                          <MapIcon size={10} /> {sensor.location}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
                        <div>
                          <div className="text-[8px] text-text-dim uppercase mb-0.5">pH</div>
                          <div className={cn("text-xs font-bold", (sensor.ph < 6.5 || sensor.ph > 8.5) && "text-danger")}>{sensor.ph}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-text-dim uppercase mb-0.5">Tur</div>
                          <div className={cn("text-xs font-bold", sensor.turbidity > 5 && "text-warning")}>{sensor.turbidity}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-text-dim uppercase mb-0.5">Temp</div>
                          <div className="text-xs font-bold">{sensor.temperature}°C</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[9px] font-mono text-text-dim">ID: {sensor.id}</span>
                        <button className="text-[9px] font-bold text-accent hover:underline uppercase tracking-tighter">View Details</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePage === 'alerts' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Active Alerts</h2>
                    <p className="text-xs text-text-dim">Real-time incident feed from sensor network.</p>
                  </div>
                  <div className="flex bg-bg p-1 rounded-lg border border-border">
                    {['all', 'low', 'medium', 'high'].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setSeverityFilter(sev as any)}
                        className={cn(
                          "px-3 py-1 rounded text-[10px] font-bold uppercase transition-all",
                          severityFilter === sev ? "bg-accent text-bg" : "text-text-dim hover:text-text-main"
                        )}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  {firestoreAlerts
                    .filter(a => severityFilter === 'all' || a.severity === severityFilter)
                    .map((alert) => (
                    <div key={alert.id} className={cn(
                      "p-5 border-b border-border last:border-0 hover:bg-bg/40 transition-colors flex items-center gap-4",
                      alert.severity === 'high' && "bg-danger/5"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        alert.severity === 'high' ? "bg-danger/10 text-danger" :
                        alert.severity === 'medium' ? "bg-warning/10 text-warning" : "bg-bg text-text-dim"
                      )}>
                        <AlertTriangle size={20} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={cn(
                            "text-[10px] font-bold uppercase py-0.5 px-1.5 rounded",
                            alert.severity === 'high' ? "bg-danger text-white" :
                            alert.severity === 'medium' ? "bg-warning/10 text-warning" : "bg-bg text-text-dim"
                          )}>
                            {alert.severity}
                          </span>
                          <span className="text-[10px] font-mono text-text-dim">Sensor ID: {alert.sensorId}</span>
                        </div>
                        <h4 className="font-bold text-sm mb-1">{alert.message}</h4>
                        <p className="text-[10px] text-text-dim lowercase">{new Date(alert.timestamp?.toDate()).toLocaleString()}</p>
                      </div>
                      <ChevronRight className="text-text-dim opacity-30" size={20} />
                    </div>
                  ))}
                  {firestoreAlerts.length === 0 && (
                    <div className="p-20 text-center space-y-3">
                      <ShieldCheck className="w-12 h-12 text-success mx-auto opacity-30" />
                      <div className="text-xl font-bold">All Clear</div>
                      <p className="text-xs text-text-dim">No active alerts meeting your criteria.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePage === 'analytics' && (
              <div className="space-y-6">
                <div className="bg-surface border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-xl font-bold">Analytics Lab</h2>
                      <p className="text-xs text-text-dim">Deep-dive into historical sensor metrics and quality trends.</p>
                    </div>
                    <div className="bg-accent text-bg px-2 py-1 rounded text-[9px] font-bold uppercase">RECHARTS ENGINE</div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8">
                    {/* pH Chart */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent">pH Level Over Time</h4>
                      <div className="h-[250px] w-full bg-bg/30 p-4 rounded-xl border border-border">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={history}>
                            <defs>
                              <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#58A6FF" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                            <XAxis dataKey="time" stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} domain={[5, 10]} />
                            <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '10px' }} />
                            <Area type="monotone" dataKey={`${activeSensor?.sensorId}_ph`} stroke="#58A6FF" fillOpacity={1} fill="url(#colorPh)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Turbidity Chart */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-warning">Turbidity Trends (NTU)</h4>
                      <div className="h-[250px] w-full bg-bg/30 p-4 rounded-xl border border-border">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                            <XAxis dataKey="time" stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '10px' }} />
                            <Line type="stepAfter" dataKey={`${activeSensor?.sensorId}_turbidity`} stroke="#D29922" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Temperature Chart */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-success">Temperature Stability (°C)</h4>
                      <div className="h-[250px] w-full bg-bg/30 p-4 rounded-xl border border-border">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                            <XAxis dataKey="time" stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#8B949E" fontSize={9} tickLine={false} axisLine={false} domain={[20, 30]} />
                            <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '10px' }} />
                            <Area type="monotone" dataKey={(d) => d[`${activeSensor?.sensorId}_ph`] ? 23 + Math.random() * 4 : 25} stroke="#238636" fill="#23863620" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SLR Lab (Preserving existing logic but in sub-section) */}
                <div className="bg-surface border border-border rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Zap className="w-5 h-5 text-accent" />
                    <h3 className="font-bold">Regression Lab (AI Core)</h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-bg/40 p-4 rounded-xl border border-border h-[300px]">
                      <PredictiveChart 
                        data={history.map((h, i) => ({ 
                          x: i, 
                          y: h[`${activeSensor?.sensorId}_ph`] || 0 
                        }))} 
                        label="pH" 
                      />
                    </div>
                    <div className="bg-bg/40 p-4 rounded-xl border border-border h-[300px]">
                      <PredictiveChart 
                        data={history.map((h, i) => ({ 
                          x: i, 
                          y: h[`${activeSensor?.sensorId}_turbidity`] || 0 
                        }))} 
                        label="Turbidity" 
                        unit=" NTU"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePage === 'settings' && (
              <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-text-dim mx-auto opacity-50" />
                <h2 className="text-xl font-bold">System Settings</h2>
                <p className="text-text-dim max-w-md mx-auto">Configure system thresholds, AI model parameters, and notification preferences.</p>
              </div>
            )}

            {activePage === 'thresholds' && (
              <div className="bg-surface border border-border rounded-xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <Info className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold">WHO Water Quality Thresholds</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-border rounded-lg bg-bg/30">
                    <div className="font-bold text-sm mb-2">pH Level</div>
                    <div className="text-xs text-text-dim">Range: 6.5 - 8.5. Essential for preventing pipe corrosion and ensuring effective disinfection.</div>
                  </div>
                  <div className="p-4 border border-border rounded-lg bg-bg/30">
                    <div className="font-bold text-sm mb-2">Turbidity</div>
                    <div className="text-xs text-text-dim">Limit: &lt; 5 NTU. High turbidity can shield pathogens from disinfection processes.</div>
                  </div>
                  <div className="p-4 border border-border rounded-lg bg-bg/30">
                    <div className="font-bold text-sm mb-2">TDS (Total Dissolved Solids)</div>
                    <div className="text-xs text-text-dim">Limit: &lt; 500 mg/L. High TDS can affect taste and indicate mineral contamination.</div>
                  </div>
                  <div className="p-4 border border-border rounded-lg bg-bg/30">
                    <div className="font-bold text-sm mb-2">Residual Chlorine</div>
                    <div className="text-xs text-text-dim">Range: 0.2 - 2.0 mg/L. Necessary to maintain secondary disinfection in the grid.</div>
                  </div>
                </div>
              </div>
            )}

            {activePage === 'api' && (
              <div className="bg-surface border border-border rounded-xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold">API Documentation</h2>
                </div>
                <div className="space-y-4">
                  <div className="font-mono text-xs p-4 bg-bg rounded border border-border">
                    <div className="text-accent mb-1">GET /api/sensors</div>
                    <div className="text-text-dim">Returns real-time metrics for all active nodes in the urban grid.</div>
                  </div>
                  <div className="font-mono text-xs p-4 bg-bg rounded border border-border">
                    <div className="text-accent mb-1">POST /api/analyze</div>
                    <div className="text-text-dim">Submit a sensor reading for AI-driven contamination classification.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppContent />
  );
}

function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer transition-all text-sm relative group",
        active 
          ? "text-accent font-bold bg-accent/10 border border-accent/20" 
          : "text-[var(--sidebar-text-dim)] hover:text-[var(--sidebar-text)] hover:bg-white/5 border border-transparent"
      )}
    >
      {active && (
        <motion.div 
          layoutId="active-pill"
          className="absolute left-0 w-1 h-4 bg-accent rounded-r-full"
        />
      )}
      <span className={cn(
        "transition-transform duration-200",
        active ? "translate-x-1" : "group-hover:translate-x-1"
      )}>
        {icon}
      </span>
      <span className={cn(
        "transition-transform duration-200",
        active ? "translate-x-1" : "group-hover:translate-x-1"
      )}>
        {label}
      </span>
    </div>
  );
}

function StatCard({ label, value, unit = "", meta, status }: { label: string, value: string, unit?: string, meta: string, status: 'success' | 'warning' | 'error' }) {
  const { theme } = useTheme();
  const metaColors = {
    success: "text-success",
    warning: "text-warning",
    error: "text-danger"
  };

  return (
    <div className={cn(
      "bg-surface border border-border p-4 rounded-lg transition-all",
      theme === 'dark' && "essential-highlight"
    )}>
      <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-baseline gap-1 font-mono">
        <span className="text-2xl font-bold text-text-main">{value}</span>
        <span className="text-xs text-text-dim">{unit}</span>
      </div>
      <div className={cn("text-[9px] font-bold mt-1 uppercase tracking-tighter", metaColors[status])}>
        {meta}
      </div>
    </div>
  );
}
