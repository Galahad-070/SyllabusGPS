export interface RoadmapNode {
  id: string;
  label: string;
  description: string;
  estimated_hours: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  topics?: string[];
}

export interface RoadmapEdge {
  source: string;
  target: string;
}

export interface RoadmapData {
  course_title: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}

export interface UploadState {
  file: File | null;
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
  roadmap: RoadmapData | null;
}

export interface StoredRoadmap {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  data: RoadmapData;
  completedNodes: string[];
}