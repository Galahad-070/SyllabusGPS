import type { RoadmapData } from '../types/roadmap';

const STORAGE_KEY = 'syllabusgps_roadmaps';

export interface StoredRoadmap {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  data: RoadmapData;
  completedNodes: string[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getStoredRoadmaps(): StoredRoadmap[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRoadmap(roadmap: Omit<StoredRoadmap, 'id' | 'createdAt' | 'updatedAt'>): StoredRoadmap {
  const roadmaps = getStoredRoadmaps();
  const newRoadmap: StoredRoadmap = {
    ...roadmap,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newRoadmap, ...roadmaps]));
  return newRoadmap;
}

export function updateRoadmap(id: string, updates: Partial<StoredRoadmap>): StoredRoadmap | null {
  const roadmaps = getStoredRoadmaps();
  const index = roadmaps.findIndex(r => r.id === id);
  if (index === -1) return null;
  
  const updated = { ...roadmaps[index], ...updates, updatedAt: Date.now() };
  roadmaps[index] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roadmaps));
  return updated;
}

export function deleteRoadmap(id: string): void {
  const roadmaps = getStoredRoadmaps().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roadmaps));
}

export function getRoadmap(id: string): StoredRoadmap | undefined {
  return getStoredRoadmaps().find(r => r.id === id);
}