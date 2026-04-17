import { collection, getDocs, addDoc, serverTimestamp, query, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const seedDatabase = async () => {
  try {
    const sensorsRef = collection(db, 'sensors');
    const sensorSnapshot = await getDocs(query(sensorsRef, limit(5)));

    const dummySensors = [
      { id: 'SN-001', name: 'NYC Main Hub', location: 'New York, USA', status: 'Active', ph: 7.2, turbidity: 2.1, temperature: 18.5, lat: 40.7128, lng: -74.0060 },
      { id: 'SN-002', name: 'Thames Filtration', location: 'London, UK', status: 'Warning', ph: 6.2, turbidity: 4.8, temperature: 14.1, lat: 51.5074, lng: -0.1278 },
      { id: 'SN-003', name: 'Tokyo Bay Outlet', location: 'Tokyo, JP', status: 'Active', ph: 7.4, turbidity: 1.5, temperature: 20.8, lat: 35.6762, lng: 139.6503 },
      { id: 'SN-004', name: 'Darling Harbour', location: 'Sydney, AUS', status: 'Critical', ph: 5.4, turbidity: 12.5, temperature: 24.5, lat: -33.8688, lng: 151.2093 },
      { id: 'SN-005', name: 'Bengaluru Tech Park', location: 'Bangalore, IN', status: 'Active', ph: 7.1, turbidity: 2.8, temperature: 28.4, lat: 12.9716, lng: 77.5946 }
    ];

    if (sensorSnapshot.empty) {
      console.log('Seeding initial global data...');
      
      for (const sensor of dummySensors) {
        await addDoc(sensorsRef, {
          ...sensor,
          timestamp: serverTimestamp()
        });
      }

      const alertsRef = collection(db, 'alerts');
      const dummyAlerts = [
        { sensorId: 'SN-004', message: 'Critical pH Levels detected (Sydney)', severity: 'high' },
        { sensorId: 'SN-002', message: 'Turbidity approaching threshold (London)', severity: 'medium' },
        { sensorId: 'SN-004', message: 'High temperature anomaly (Sydney)', severity: 'medium' }
      ];

      for (const alert of dummyAlerts) {
        await addDoc(alertsRef, {
          ...alert,
          id: `AL-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: serverTimestamp()
        });
      }
      
      console.log('Global database seeded successfully.');
    } else {
      // Force update existing seed data so the user's view correctly becomes global without needing to delete their database.
      console.log('Checking if legacy local coordinates need migrating to global map...');
      sensorSnapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        const matchedSeed = dummySensors.find(s => s.id === data.id);
        if (matchedSeed && (data.lat !== matchedSeed.lat || data.lng !== matchedSeed.lng)) {
          console.log(`Migrating ${matchedSeed.id} to new global coordinates...`);
          // Note: using direct update on doc Reference is better but for quick migration we can just update.
          // Wait, addDoc creates random IDs, and the sensor ID is stored in the doc body as 'id'.
          // We must update the document via its docSnap.id
          await updateDoc(doc(db, 'sensors', docSnap.id), {
            lat: matchedSeed.lat,
            lng: matchedSeed.lng,
            location: matchedSeed.location,
            name: matchedSeed.name
          });
        }
      });
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};
