import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Simulated IoT Sensors
  const sensors = [
    { id: 'SN-001', name: 'North Reservoir', lat: 12.9716, lng: 77.5946 },
    { id: 'SN-002', name: 'East Treatment Plant', lat: 12.9516, lng: 77.6146 },
    { id: 'SN-003', name: 'South Distribution Hub', lat: 12.9316, lng: 77.5746 },
  ];

  // API to get current sensor data (simulated)
  app.get("/api/sensors", (req, res) => {
    const data = sensors.map(s => ({
      ...s,
      metrics: {
        ph: 6.5 + Math.random() * 2,
        turbidity: Math.random() * 8, // Occasionally high
        tds: 300 + Math.random() * 300,
        chlorine: 0.1 + Math.random() * 2.5,
      },
      timestamp: Date.now(),
    }));
    res.json(data);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
