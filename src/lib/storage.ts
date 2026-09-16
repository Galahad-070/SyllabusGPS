import type { RoadmapData, TutoringSession } from '../types/roadmap';

const STORAGE_KEY = 'syllabusgps_roadmaps';
const TUTORING_KEY = 'syllabusgps_tutoring';

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

// Tutoring storage
export function getTutoringSessions(): TutoringSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(TUTORING_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getTutoringSession(roadmapId: string, nodeId: string): TutoringSession | undefined {
  const sessions = getTutoringSessions();
  return sessions.find(s => s.roadmapId === roadmapId && s.nodeId === nodeId);
}

export function saveTutoringSession(session: Omit<TutoringSession, 'createdAt' | 'updatedAt'>): TutoringSession {
  const sessions = getTutoringSessions();
  const existingIndex = sessions.findIndex(s => s.roadmapId === session.roadmapId && s.nodeId === session.nodeId);
  
  const newSession: TutoringSession = {
    ...session,
    createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = newSession;
  } else {
    sessions.unshift(newSession);
  }
  
  localStorage.setItem(TUTORING_KEY, JSON.stringify(sessions));
  return newSession;
}

export function addTutoringMessage(roadmapId: string, nodeId: string, message: { role: 'user' | 'assistant'; content: string }): TutoringSession | null {
  const sessions = getTutoringSessions();
  const index = sessions.findIndex(s => s.roadmapId === roadmapId && s.nodeId === nodeId);
  
  if (index === -1) return null;
  
  const session = sessions[index];
  const newMessage = {
    ...message,
    timestamp: Date.now(),
  };
  
  sessions[index] = {
    ...session,
    messages: [...session.messages, newMessage],
    updatedAt: Date.now(),
  };
  
  localStorage.setItem(TUTORING_KEY, JSON.stringify(sessions));
  return sessions[index];
}

export function updateTutoringNotes(roadmapId: string, nodeId: string, notes: string): TutoringSession | null {
  const sessions = getTutoringSessions();
  const index = sessions.findIndex(s => s.roadmapId === roadmapId && s.nodeId === nodeId);
  
  if (index === -1) return null;
  
  sessions[index] = {
    ...sessions[index],
    notes,
    updatedAt: Date.now(),
  };
  
  localStorage.setItem(TUTORING_KEY, JSON.stringify(sessions));
  return sessions[index];
}