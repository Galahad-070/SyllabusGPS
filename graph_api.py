import pdfplumber
import json
from openai import OpenAI

# 1. Initialize the Groq client (using OpenAI library pointed to Groq)
client = OpenAI(
    api_key="",
    base_url="https://api.groq.com/openai/v1"
)

# 2. Extract raw text from PDF
def extract_text_from_syllabus(pdf_path: str) -> str:
    raw_text = ""
    print(f"Extracting text from {pdf_path}...")
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                raw_text += extracted + "\n"
    return raw_text

# 3. Call Groq for structured JSON
def generate_roadmap_json(syllabus_text: str):
    print("Sending text to Groq for roadmap generation...")
    
    system_prompt = """
    Analyze the syllabus and output ONLY a raw JSON object representing a study roadmap. 
    Format EXACTLY like this: 
    {"course_title": "...", "nodes": [{"id": "...", "label": "...", "description": "...", "estimated_hours": 2.5}], "edges": [{"source": "...", "target": "..."}]}
    """

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": syllabus_text}
        ],
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)

# 4. Run the Pipeline
if __name__ == "__main__":
    pdf_file = "Syllabus_23CST202.pdf"
    
    text = extract_text_from_syllabus(pdf_file)
    graph_json = generate_roadmap_json(text)
    
    print("\n--- Generated Roadmap JSON ---")
    print(json.dumps(graph_json, indent=2))