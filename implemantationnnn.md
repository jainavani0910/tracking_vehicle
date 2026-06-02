Detailed Step-by-Step Workflow Real-Time Vehicle Tracking
System (2-Person Team)
This document explains the complete detailed workflow for building a production-level real-time vehicle tracking
system from zero level using a 2-person team. The system is designed for scalable real-time rendering using React,
Maplibre GL JS, Node.js, Redis, Socket.IO, and AutoMQ/Kafka.




STEP 1 — UNDERSTAND PROJECT REQUIREMENTS
Goals:
• Render live vehicles on map
• Vehicles update every 2 seconds
• Support thousands of vehicles
• Smooth movement
• Scalable architecture
Things to decide:
• Frontend technologies
• Backend technologies
• Event streaming system
• Rendering strategy
• Scaling strategy
Final Selected Stack:
Frontend:
• React
• Vite
• Tailwind CSS
• Maplibre GL JS
• Zustand
• Socket.IO Client
Backend:
• Node.js
• Express.js
• Socket.IO
• Redis
• AutoMQ/Kafka




STEP 2 — DIVIDE WORK BETWEEN 2 PEOPLE
Frontend Engineer Responsibilities:
• React setup
• Maplibre setup
• Vehicle rendering
• Viewport filtering
• GeoJSON rendering
• Clustering
• Smooth animation
• Performance optimization
Backend Engineer Responsibilities:
• Node.js server
• Express APIs
• Socket.IO server
• Redis integration
• Kafka/AutoMQ integration
• Vehicle simulator
• Event processing
• Backend optimization




STEP 3 — INITIAL PROJECT SETUP
Frontend Engineer:
1. Create React project using Vite2. Install Tailwind CSS
3. Install Maplibre GL JS
4. Create map container
5. Setup basic map rendering
Goal:
Display world map successfully.
Backend Engineer:
1. Create Node.js project
2. Setup Express.js server
3. Setup Socket.IO
4. Create backend API structure
5. Setup Kafka/AutoMQ connection
Goal:
Backend server runs successfully.




STEP 4 — UNDERSTAND Maplibre ARCHITECTURE
Important Understanding:
React should NOT render thousands of markers directly.
Wrong:
vehicles.map(vehicle => Marker)
Correct:
Vehicle data → GeoJSON → Maplibre Source → GPU Rendering
Why?
Maplibre uses WebGL/GPU rendering which is much faster for large-scale rendering.
Frontend Engineer Tasks:
1. Learn Maplibre sources
2. Learn Maplibre layers
3. Learn GeoJSON rendering
4. Learn map events
5. Learn viewport bounds




STEP 5 — BUILD VEHICLE SIMULATOR
Backend Engineer creates fake vehicle generator.
Vehicle simulator responsibilities:
• generate vehicle IDs
• generate coordinates
• generate speed
• generate direction
• simulate movement
Flow:
Vehicle Simulator
↓
Kafka/AutoMQ
Purpose:
Generate realistic live vehicle streams for testing.




STEP 6 — SETUP KAFKA/AUTOMQ PIPELINE
Backend Engineer Tasks:
1. Create Kafka topics
2. Push vehicle events into Kafka
3. Setup Kafka consumer
4. Consume vehicle updates continuously
Why Kafka/AutoMQ?
• Handles large event streams
• Buffers traffic spikes
• Prevents backend overload
• Scalable architectureFlow:
Vehicle Simulator
↓
Kafka/AutoMQ
↓
Node.js Consumer




STEP 7 — STORE LIVE DATA IN REDIS
Backend Engineer Tasks:
1. Store latest vehicle positions
2. Cache active vehicles
3. Optimize fast lookups
Why Redis?
• Extremely fast
• In-memory storage
• Better real-time performance
Flow:
Kafka Consumer
↓
Redis stores latest positions




STEP 8 — SETUP SOCKET.IO REAL-TIME PIPELINE
Backend Engineer:
1. Setup Socket.IO server
2. Broadcast vehicle updates
3. Batch updates efficiently
Frontend Engineer:
1. Connect Socket.IO client
2. Receive live updates
3. Update frontend state
Flow:
Redis / Backend
↓
Socket.IO
↓
Frontend




STEP 9 — FRONTEND LIVE VEHICLE RENDERING
Frontend Engineer Tasks:
1. Receive live updates
2. Store latest positions in Zustand
3. Convert data into GeoJSON
4. Update maplibre source
5. Render live vehicles
Rendering Flow:
Socket.IO Updates
↓
Zustand Store
↓
GeoJSON Conversion
↓
Maplibre Source Update
↓
GPU Rendering




STEP 10 — VIEWPORT FILTERING
Problem:
Frontend cannot render all vehicles.
Solution:
Render only visible vehicles.Frontend Engineer Tasks:
1. Get current map bounds
2. Filter visible vehicles
3. Update only visible GeoJSON
Benefits:
• Better FPS
• Lower memory usage
• Better mobile performance




STEP 11 — CLUSTERING
Problem:
Vehicles overlap when zoomed out.
Solution:
Use Supercluster.
Frontend Engineer Tasks:
1. Integrate Supercluster
2. Group nearby vehicles
3. Render cluster bubbles
Benefits:
• Better readability
• Better performance
• Reduced rendering load




STEP 12 — SMOOTH VEHICLE MOVEMENT
Problem:
Vehicle jumps look bad.
Solution:
Use interpolation animations.
Frontend Engineer Tasks:
1. Store old position
2. Animate toward new position
3. Use requestAnimationFrame
Goal:
Professional smooth movement.





STEP 13 — PERFORMANCE OPTIMIZATION
Frontend Engineer:
• Reduce unnecessary rerenders
• Optimize GeoJSON updates
• Use viewport filtering
• Use clustering
• Optimize FPS
Backend Engineer:
• Optimize Kafka throughput
• Optimize Redis writes
• Batch Socket.IO events
• Reduce payload sizes




STEP 14 — SCALING STRATEGY
Initial Scale:
• Single Node.js server
• Kafka/AutoMQ
• Redis
• Socket.IO
Later Scaling:
• Multiple backend servers
• Load balancer• Redis cluster
• Distributed Kafka consumers
Important:
Scale only when required.





STEP 15 — FINAL PRODUCTION FLOW
Vehicle GPS Devices
↓
Vehicle Simulator / Real Streams
↓
Kafka / AutoMQ
↓
Node.js Consumer
↓
Redis
↓
Socket.IO Server
↓
Frontend React App
↓
Zustand State
↓
GeoJSON Conversion
↓
Maplibre WebGL Rendering
Final Goals:
• Smooth rendering
• Real-time updates
• Scalable architecture
• High-performance frontend