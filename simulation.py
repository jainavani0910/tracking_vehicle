import time
import json
import random
import math
import urllib.request

# Configuration
# Replace 192.168.1.180 with your PC's IP if needed
API_URL = "http://192.168.1.21:3000/api/vehicles/update_batch"
NUM_VEHICLES = 1000
UPDATE_INTERVAL = 1.0  # 1 second

def main():
    print(f"Sending telemetry data to {API_URL}...")
    # Initialize 1000 vehicles with random data
    vehicles = {}
    for i in range(NUM_VEHICLES):
        vehicles[f'vehicle-{i}'] = {
            'id': f'vehicle-{i}',
            'latitude': random.uniform(28.4, 28.8),
            'longitude': random.uniform(77.0, 77.4),
            'speed': random.uniform(20.0, 100.0),
            'heading': random.uniform(0.0, 360.0)
        }

    print(f"Started simulation of {NUM_VEHICLES} vehicles.")
    
    try:
        while True:
            start_time = time.time()
            
            for v_id, vehicle in vehicles.items():
                # Update position mathematically based on speed and heading
                speed_mps = (vehicle['speed'] * 1000) / 3600
                distance = speed_mps * UPDATE_INTERVAL
                
                angle_rad = math.radians(vehicle['heading'])
                
                # Approximate degree conversion for Delhi coordinates
                delta_lat = (distance * math.cos(angle_rad)) / 111111
                delta_lon = (distance * math.sin(angle_rad)) / (111111 * math.cos(math.radians(vehicle['latitude'])))
                
                vehicle['latitude'] += delta_lat
                vehicle['longitude'] += delta_lon
                
                # Bounce off boundaries (Simple geofence around Delhi region)
                if vehicle['latitude'] > 28.8 or vehicle['latitude'] < 28.4:
                    vehicle['heading'] = 180 - vehicle['heading']
                if vehicle['longitude'] > 77.4 or vehicle['longitude'] < 77.0:
                    vehicle['heading'] = 360 - vehicle['heading']
                
                # Random realistic heading changes
                if random.random() > 0.95:
                    vehicle['heading'] = (vehicle['heading'] + random.uniform(-20, 20)) % 360
                
                
            # Send telemetry data payload via HTTP API batch
            try:
                vehicles_list = list(vehicles.values())
                data = json.dumps(vehicles_list).encode('utf-8')
                req = urllib.request.Request(API_URL, data=data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=1.0) as response:
                    pass
            except Exception as e:
                print(f"API request failed: {e}")
            
            elapsed = time.time() - start_time
            sleep_time = UPDATE_INTERVAL - elapsed
            
            # Maintain 1 send per second
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    except KeyboardInterrupt:
        print("\nStopping simulation...")

if __name__ == '__main__':
    main()
 