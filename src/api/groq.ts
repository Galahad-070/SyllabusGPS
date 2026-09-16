import type { RoadmapData } from '../types/roadmap';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';
const MAX_INPUT_CHARS = 12000;

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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[Content truncated due to length limit]';
}

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }
  
  if (!fullText.trim()) {
    throw new Error('Could not extract text from PDF. The file may be empty or image-based.');
  }
  
  return truncateText(fullText, MAX_INPUT_CHARS);
}

export async function generateRoadmap(syllabusText: string): Promise<RoadmapData> {
  const systemPrompt = `
Analyze the syllabus and output ONLY a raw JSON object representing a study roadmap. 
Format EXACTLY like this: 
{"course_title": "...", "nodes": [{"id": "...", "label": "...", "description": "...", "estimated_hours": 2.5, "difficulty": "beginner|intermediate|advanced", "topics": ["topic1", "topic2"]}], "edges": [{"source": "...", "target": "..."}]}

Rules:
- Each node must have unique id, label, description, estimated_hours (number), difficulty ("beginner", "intermediate", or "advanced"), and topics (array of strings)
- Edges represent prerequisites/dependencies (source -> target)
- Create logical learning sequence from fundamentals to advanced topics
- Include 8-15 nodes for a typical semester course
- Hours should be realistic estimates for mastery
- Mark foundational topics as "beginner", core topics as "intermediate", and capstone/advanced topics as "advanced"
`.trim();

  const truncatedText = truncateText(syllabusText, MAX_INPUT_CHARS);

  const result = await callGroqApi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: truncatedText }
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