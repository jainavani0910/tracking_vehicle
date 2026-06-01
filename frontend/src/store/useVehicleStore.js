import { create } from 'zustand';

export const useVehicleStore = create((set) => ({
  vehicles: [],
  selectedVehicleHistory: [],
  selectedVehicleId: null,
  latency: 0,
  isConnected: false,
  updatesCount: 0, // Updates per second metric
  
  setVehicles: (vehicles) => 
    set((state) => ({ 
      vehicles,
      updatesCount: state.updatesCount + vehicles.length
    })),
  
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
