import type { RoadmapNode } from '../types/roadmap';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';

function getApiKey(): string {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API key not configured. Please add VITE_GROQ_API_KEY to your .env file.');
  }
  return key;
}

async function callGroqApi(messages: Array<{ role: string; content: string }>) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API request failed: ${response.status}`);
  }

  return response.json();
}

export async function generateTutoringNotes(node: RoadmapNode, courseTitle: string): Promise<string> {
  const systemPrompt = `You are an expert tutor creating comprehensive study notes for a specific module in a course.

Course: ${courseTitle}
Module: ${node.label}
Description: ${node.description}
Topics: ${node.topics?.join(', ') || 'Not specified'}
Estimated Hours: ${node.estimated_hours}

Create detailed, well-structured study notes that cover:
1. Key concepts and definitions
2. Important formulas, theorems, or principles
3. Step-by-step explanations for complex topics
4. Common pitfalls and how to avoid them
5. Practice problems or examples
6. Connections to prerequisite topics

Format as clean markdown with headers, bullet points, and code blocks where appropriate. Be thorough but concise.`;

  const result = await callGroqApi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate comprehensive study notes for "${node.label}"` }
  ]);

  return result.choices[0]?.message?.content || 'Failed to generate notes.';
}

export async function askTutoringQuestion(
  node: RoadmapNode,
  courseTitle: string,
  notes: string,
  previousMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }>,
  question: string
): Promise<string> {
  const systemPrompt = `You are an expert tutor helping a student understand a specific module.

Course: ${courseTitle}
Module: ${node.label}
Description: ${node.description}
Topics: ${node.topics?.join(', ') || 'Not specified'}

Study Notes (context):
${notes || 'No notes generated yet.'}

Answer the student's question clearly and thoroughly. Use the study notes as context. If the question relates to previous discussion, maintain continuity. Provide examples, analogies, and step-by-step explanations when helpful.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...previousMessages.slice(-6).map(({ role, content }) => ({ role, content })),
    { role: 'user', content: question }
  ];

  const result = await callGroqApi(messages);
  return result.choices[0]?.message?.content || 'Failed to generate response.';
}