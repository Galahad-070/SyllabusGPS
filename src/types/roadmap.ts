export interface RoadmapNode {
  id: string;
  label: string;
  description: string;
  estimated_hours: number;
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