import { collection, getDocs, addDoc, serverTimestamp, query, limit } from 'firebase/firestore';
import { db } from './firebase';

export const seedDatabase = async () => {
  try {
    // Check if sensors collection is empty
    const sensorsRef = collection(db, 'sensors');
    const sensorSnapshot = await getDocs(query(sensorsRef, limit(1)));

    if (sensorSnapshot.empty) {
      console.log('Seeding initial data...');
      
      const dummySensors = [
        { id: 'SN-001', name: 'West Reservoir', location: 'Section A-1', status: 'Active', ph: 7.2, turbidity: 2.1, temperature: 24.5, lat: 12.9716, lng: 77.5946 },
        { id: 'SN-002', name: 'Main Filtration', location: 'Section B-4', status: 'Warning', ph: 6.2, turbidity: 4.8, temperature: 26.1, lat: 12.9516, lng: 77.6146 },
        { id: 'SN-003', name: 'City Outlet', location: 'South Gate', status: 'Active', ph: 7.4, turbidity: 1.5, temperature: 23.8, lat: 12.9316, lng: 77.5746 },
        { id: 'SN-004', name: 'Industrial Intake', location: 'East Sector', status: 'Critical', ph: 5.4, turbidity: 12.5, temperature: 28.5, lat: 12.9916, lng: 77.6346 },
        { id: 'SN-005', name: 'North Dam', location: 'Vallejo Lake', status: 'Active', ph: 7.1, turbidity: 2.8, temperature: 22.4, lat: 12.9116, lng: 77.5546 }
      ];

      for (const sensor of dummySensors) {
        await addDoc(sensorsRef, {
          ...sensor,
          timestamp: serverTimestamp()
        });
      }

      const alertsRef = collection(db, 'alerts');
      const dummyAlerts = [
        { sensorId: 'SN-004', message: 'Critical pH Levels detected', severity: 'high' },
        { sensorId: 'SN-002', message: 'Turbidity approaching threshold', severity: 'medium' },
        { sensorId: 'SN-004', message: 'High temperature anomaly', severity: 'medium' }
      ];

      for (const alert of dummyAlerts) {
        await addDoc(alertsRef, {
          ...alert,
          id: `AL-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: serverTimestamp()
        });
      }
      
      console.log('Database seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};
