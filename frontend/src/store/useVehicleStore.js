import { create } from 'zustand';

export const useVehicleStore = create((set) => ({
  vehicles: [],
  selectedVehicleHistory: [],
  selectedVehicleId: null,
  latency: 0,
  isConnected: false,
  updatesCount: 0, // Updates per second metric
  visibleVehicles: [],
  visibleVehiclesCount: 0,
  
  setVisibleVehicles: (visibleVehicles) => set({ visibleVehicles, visibleVehiclesCount: visibleVehicles.length }),
  setVisibleVehiclesCount: (count) => set({ visibleVehiclesCount: count }),

  // Full replacement — used when the server sends an initial snapshot
  replaceVehicles: (incomingVehicles) =>
    set({
      vehicles: incomingVehicles,
      updatesCount: incomingVehicles.length,
    }),

  // Merge update — used for delta ticks, preserves vehicles not in the delta
  setVehicles: (incomingVehicles) =>
    set((state) => {
      const map = new Map(state.vehicles.map(v => [v.id, v]));
      incomingVehicles.forEach(v => map.set(v.id, v));
      return {
        vehicles: Array.from(map.values()),
        updatesCount: state.updatesCount + incomingVehicles.length,
      };
    }),

  setSelectedVehicleHistory: (history) => set({ selectedVehicleHistory: history }),
  
  setSelectedVehicleId: (id) => set({ selectedVehicleId: id, selectedVehicleHistory: [] }), // Reset history on click
  
  setLatency: (latency) => set({ latency }),
  
  setIsConnected: (connected) => set({ isConnected: connected }),
  
  resetUpdatesCount: () => set({ updatesCount: 0 }),

  updateVehicle: (updatedVehicle) =>
    set((state) => {
      const vehicleExists = state.vehicles.some(v => v.id === updatedVehicle.id);
      if (vehicleExists) {
        return {
          vehicles: state.vehicles.map((v) =>
            v.id === updatedVehicle.id ? { ...v, ...updatedVehicle } : v
          ),
          updatesCount: state.updatesCount + 1
        };
      }
      return { 
        vehicles: [...state.vehicles, updatedVehicle],
        updatesCount: state.updatesCount + 1
      };
    }),
  
  addVehicle: (vehicle) =>
    set((state) => ({
      vehicles: [...state.vehicles, vehicle],
    })),

  removeVehicle: (vehicleId) =>
    set((state) => ({
      vehicles: state.vehicles.filter((v) => v.id !== vehicleId),
    })),
}));
