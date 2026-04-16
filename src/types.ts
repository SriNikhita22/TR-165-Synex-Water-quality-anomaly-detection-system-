export interface SensorData {
  id: string;
  timestamp: number;
  sensorId: string;
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  metrics: {
    ph: number;
    turbidity: number;
    tds: number;
    chlorine: number;
    temperature?: number;
  };
}

export interface Alert {
  id: string;
  timestamp: number;
  sensorId: string;
  type: 'CHEMICAL' | 'BIOLOGICAL' | 'PHYSICAL' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  metrics: {
    ph: number;
    turbidity: number;
    tds: number;
    chlorine: number;
  };
  actions: string[];
  notes?: string;
  recommendation?: string;
  radius?: number; // in meters
}

export const THRESHOLDS = {
  PH: { min: 6.5, max: 8.5 },
  TURBIDITY: { max: 5 }, // NTU
  TDS: { max: 500 }, // mg/L
  CHLORINE: { min: 0.2, max: 2.0 }, // mg/L
};
