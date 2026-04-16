import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
import math

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371000 # Radius of earth in meters. Use 3956 for miles
    return c * r

def estimate_contamination_spread(anomalous_sensors, contamination_type='unknown'):
    """
    Estimates the affected zone radius and center point.
    """
    if not anomalous_sensors:
        return None

    # Base radius by contamination type
    type_base_radius = {
        'chemical': 500,
        'biological': 1000,
        'physical': 200,
        'unknown': 300
    }
    
    base_radius = type_base_radius.get(contamination_type, 300)
    
    # If isolated anomaly
    if len(anomalous_sensors) == 1:
        sensor = anomalous_sensors[0]
        return {
            'center': (sensor['lat'], sensor['lng']),
            'radius': base_radius,
            'affected_sensors': [sensor['id']]
        }

    # Extract coordinates for clustering
    coords = np.array([[s['lat'], s['lng']] for s in anomalous_sensors])
    
    # DBSCAN clustering (eps is roughly in degrees, 0.01 deg ~ 1.1km)
    clustering = DBSCAN(eps=0.01, min_samples=1).fit(coords)
    labels = clustering.labels_
    
    # Find the largest cluster
    unique_labels, counts = np.unique(labels, return_counts=True)
    largest_cluster_label = unique_labels[np.argmax(counts)]
    
    cluster_indices = np.where(labels == largest_cluster_label)[0]
    cluster_sensors = [anomalous_sensors[i] for i in cluster_indices]
    cluster_coords = coords[cluster_indices]
    
    # Center point (mean of cluster)
    center_lat = np.mean(cluster_coords[:, 0])
    center_lng = np.mean(cluster_coords[:, 1])
    
    # Calculate radius based on spread of sensors in cluster
    max_dist = 0
    for s in cluster_sensors:
        dist = haversine(center_lat, center_lng, s['lat'], s['lng'])
        if dist > max_dist:
            max_dist = dist
            
    # Final radius = spread + base buffer
    final_radius = max_dist + base_radius
    
    return {
        'center': (center_lat, center_lng),
        'radius': round(final_radius, 2),
        'affected_sensors': [s['id'] for s in cluster_sensors]
    }

def visualize_spread(sensors, estimation):
    """
    Visualizes sensors and the estimated contamination zone.
    """
    plt.figure(figsize=(10, 8))
    
    # Plot all sensors
    lats = [s['lat'] for s in sensors]
    lngs = [s['lng'] for s in sensors]
    plt.scatter(lngs, lats, c='blue', label='Normal Sensors', alpha=0.5)
    
    if estimation:
        center_lat, center_lng = estimation['center']
        radius = estimation['radius']
        
        # Highlight anomalous sensors
        affected_ids = estimation['affected_sensors']
        affected_lats = [s['lat'] for s in sensors if s['id'] in affected_ids]
        affected_lngs = [s['lng'] for s in sensors if s['id'] in affected_ids]
        plt.scatter(affected_lngs, affected_lats, c='red', label='Anomalous Sensors', s=100)
        
        # Draw radius (approximate circle in lat/lng space)
        # 1 degree lat ~ 111,000 meters
        # 1 degree lng ~ 111,000 * cos(lat) meters
        lat_deg = radius / 111000
        lng_deg = radius / (111000 * math.cos(math.radians(center_lat)))
        
        circle = plt.Circle((center_lng, center_lat), lng_deg, color='red', fill=True, alpha=0.2, label='Affected Zone')
        plt.gca().add_patch(circle)
        
        plt.scatter([center_lng], [center_lat], c='black', marker='x', s=100, label='Zone Center')

    plt.xlabel('Longitude')
    plt.ylabel('Latitude')
    plt.title('Geo-Spatial Contamination Spread Estimation')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig('contamination_spread_viz.png')
    print("Spread visualization saved to contamination_spread_viz.png")

if __name__ == "__main__":
    # Mock sensors
    sensors = [
        {'id': 'SN-001', 'lat': 12.9716, 'lng': 77.5946},
        {'id': 'SN-002', 'lat': 12.9756, 'lng': 77.5986},
        {'id': 'SN-003', 'lat': 12.9686, 'lng': 77.5916},
        {'id': 'SN-004', 'lat': 12.9816, 'lng': 77.6046},
        {'id': 'SN-005', 'lat': 12.9516, 'lng': 77.6146},
    ]
    
    # Case: Multiple nearby anomalies
    anomalous = [sensors[0], sensors[1], sensors[2]]
    
    print("Estimating spread for multiple anomalies...")
    est = estimate_contamination_spread(anomalous, contamination_type='biological')
    print(f"Estimation: {est}")
    
    visualize_spread(sensors, est)
