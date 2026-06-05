import { create } from "zustand";

export interface ProjectStoreState {
  applyOperation: (op: unknown) => void;
  reloadFullState: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  applyOperation: (op: unknown) => {
    console.log("Mock applyOperation called with:", op);
    // TODO: Implement actual Zustand merge logic here based on your timeline structure
  },
  reloadFullState: async (projectId: string) => {
    console.log(`Mock reloadFullState called for project: ${projectId}`);
    // TODO: Implement actual full fetch and state replace logic here
  },
}));
