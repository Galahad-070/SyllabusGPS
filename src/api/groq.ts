import type { RoadmapData } from '../types/roadmap';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';

interface UploadResponse {
  text: string;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API key not configured. Please add VITE_GROQ_API_KEY to your .env file.');
  }
  return key;
}

async function callGroqApi(messages: Array<{ role: string; content: string }>, responseFormat?: { type: string }) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: responseFormat,
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API request failed: ${response.status}`);
  }

  return response.json();
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  const result = await callGroqApi([
    {
      role: 'system',
      content: 'You are a PDF text extractor. Extract all text content from the provided PDF base64 data. Return ONLY the extracted text, no additional commentary.'
    },
    {
      role: 'user',
      content: `Extract text from this PDF (base64): ${base64}`
    }
  ]);

  const extractedText = result.choices[0]?.message?.content || '';
  
  if (!extractedText.trim()) {
    throw new Error('Could not extract text from PDF. The file may be empty or image-based.');
  }

  return { text: extractedText };
}

export async function generateRoadmap(syllabusText: string): Promise<RoadmapData> {
  const systemPrompt = `
Analyze the syllabus and output ONLY a raw JSON object representing a study roadmap. 
Format EXACTLY like this: 
{"course_title": "...", "nodes": [{"id": "...", "label": "...", "description": "...", "estimated_hours": 2.5}], "edges": [{"source": "...", "target": "..."}]}

Rules:
- Each node must have unique id, label, description, and estimated_hours (number)
- Edges represent prerequisites/dependencies (source -> target)
- Create logical learning sequence from fundamentals to advanced topics
- Include 8-15 nodes for a typical semester course
- Hours should be realistic estimates for mastery
`.trim();

  const result = await callGroqApi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: syllabusText }
  ], { type: 'json_object' });

  try {
    const parsed = JSON.parse(result.choices[0]?.message?.content || '{}');
    
    if (!parsed.course_title || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      throw new Error('Invalid roadmap format returned from API');
    }
    
    return parsed as RoadmapData;
  } catch (e) {
    throw new Error('Failed to parse roadmap from API response');
  }
}