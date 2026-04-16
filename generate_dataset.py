import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

def generate_water_quality_dataset(num_sensors=10, hours=48, include_drift=True):
    """
    Generates a realistic water quality dataset with time-series anomalies and concept drift.
    """
    start_time = datetime.now() - timedelta(hours=hours)
    num_minutes = hours * 60
    timestamps = [start_time + timedelta(minutes=i) for i in range(num_minutes)]
    
    # Define sensors in a global grid
    base_lat, base_lng = 20.0, 0.0
    sensors = []
    for i in range(num_sensors):
        sensors.append({
            'id': f'SN-{str(i+1).zfill(3)}',
            'lat': base_lat + random.uniform(-30, 30),
            'lng': base_lng + random.uniform(-100, 100)
        })
    
    data = []
    
    # Concept Drift Simulation: 
    # Slowly increasing turbidity and decaying chlorine over the entire duration
    drift_turbidity = np.linspace(0, 1.5, num_minutes) if include_drift else np.zeros(num_minutes)
    drift_chlorine = np.linspace(0, -0.2, num_minutes) if include_drift else np.zeros(num_minutes)
    
    for t_idx, ts in enumerate(timestamps):
        # Global trend or time-of-day noise
        time_factor = np.sin(ts.hour / 24 * 2 * np.pi) * 0.1
        
        # Randomly decide if there's a cluster anomaly
        is_cluster_anomaly = random.random() < 0.005 
        anomaly_type = 'none'
        if is_cluster_anomaly:
            anomaly_type = random.choice(['chemical', 'biological', 'physical'])
            affected_sensors = random.sample(range(num_sensors), k=random.randint(2, 4))
        else:
            affected_sensors = []

        for i, sensor in enumerate(sensors):
            # Base normal values with noise + drift
            ph = 7.2 + time_factor + np.random.normal(0, 0.1)
            turbidity = 2.5 + drift_turbidity[t_idx] + np.random.normal(0, 0.5)
            tds = 150 + np.random.normal(0, 10)
            chlorine = 0.6 + drift_chlorine[t_idx] + np.random.normal(0, 0.05)
            
            label = 0
            current_anomaly = 'none'
            
            # Inject anomalies (should stand out even with drift)
            if i in affected_sensors:
                label = 1
                current_anomaly = anomaly_type
                if anomaly_type == 'chemical':
                    ph += random.choice([-1.5, 1.5]) + np.random.normal(0, 0.5)
                elif anomaly_type == 'biological':
                    chlorine -= 0.4 + np.random.normal(0, 0.1)
                    turbidity += 8.0 + np.random.normal(0, 2.0)
                elif anomaly_type == 'physical':
                    turbidity += 15.0 + np.random.normal(0, 5.0)
            
            # Clip to realistic bounds
            ph = np.clip(ph, 0, 14)
            turbidity = max(0, turbidity)
            tds = max(0, tds)
            chlorine = max(0, chlorine)
            
            data.append({
                'timestamp': ts,
                'sensor_id': sensor['id'],
                'ph': ph,
                'turbidity': turbidity,
                'tds': tds,
                'chlorine': chlorine,
                'anomaly_label': label,
                'anomaly_type': current_anomaly
            })
            
    df = pd.DataFrame(data)
    return df

def preprocess_and_split(df):
    """
    Normalizes features and splits into train/test sets.
    """
    features = ['ph', 'turbidity', 'tds', 'chlorine']
    X = df[features]
    y = df['anomaly_label']
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_scaled_df = pd.DataFrame(X_scaled, columns=features)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled_df, y, test_size=0.2, random_state=42, stratify=y
    )
    
    return X_train, X_test, y_train, y_test, scaler

def visualize_data(df, sensor_id=None):
    """
    Visualizes water quality metrics and highlights anomalies.
    """
    if sensor_id is None:
        sensor_id = df['sensor_id'].iloc[0]
    
    sensor_data = df[df['sensor_id'] == sensor_id].copy()
    sensor_data = sensor_data.sort_values('timestamp')
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10), sharex=True)
    
    # pH over time
    ax1.plot(sensor_data['timestamp'], sensor_data['ph'], label='pH', color='blue', alpha=0.6)
    anomalies = sensor_data[sensor_data['anomaly_label'] == 1]
    ax1.scatter(anomalies['timestamp'], anomalies['ph'], color='red', label='Anomaly', zorder=5)
    ax1.set_ylabel('pH Level')
    ax1.set_title(f'Water Quality Metrics for {sensor_id}')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Turbidity spikes
    ax2.plot(sensor_data['timestamp'], sensor_data['turbidity'], label='Turbidity (NTU)', color='green', alpha=0.6)
    ax2.scatter(anomalies['timestamp'], anomalies['turbidity'], color='red', zorder=5)
    ax2.set_ylabel('Turbidity (NTU)')
    ax2.set_xlabel('Timestamp')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('water_quality_visualization.png')
    print("Visualization saved to water_quality_visualization.png")

if __name__ == "__main__":
    print("Generating dataset with concept drift...")
    df = generate_water_quality_dataset()
    
    # Save raw data
    df.to_csv('water_quality_simulated_data.csv', index=False)
    
    # Preprocess and split
    X_train, X_test, y_train, y_test, scaler = preprocess_and_split(df)
    print(f"Dataset split: Train={len(X_train)}, Test={len(X_test)}")
    
    # Visualize
    visualize_data(df)
    
    print("\nSample of normalized training data:")
    print(X_train.head())
