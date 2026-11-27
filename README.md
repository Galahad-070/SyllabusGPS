# SyllabusGPS

Transform your syllabus PDF into an interactive study roadmap powered by AI.

## Features

- **Drag & Drop Upload** - Simply drop your syllabus PDF or click to browse
- **AI-Powered Analysis** - Uses Groq (GPT-OSS-20B) to extract and analyze syllabus content
- **Interactive Roadmap** - Generates structured learning path with nodes, hours, and dependencies
- **Responsive Design** - Works seamlessly on mobile, tablet, and desktop
- **Modern UI** - Clean, accessible interface with Tailwind CSS

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS 4
- Groq API (GPT-OSS-20B)

## Getting Started

### Prerequisites

- Node.js 18+
- Groq API key (get one at [console.groq.com](https://console.groq.com))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd syllabus-gps

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Groq API key

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Project Structure

```
syllabus-gps/
├── src/
│   ├── api/
│   │   └── groq.ts          # Groq API integration
│   ├── components/
│   │   └── UploadZone.tsx   # Drag-and-drop upload component
│   ├── types/
│   │   └── roadmap.ts       # TypeScript interfaces
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind imports
├── .env.example             # Environment template
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── vite.config.ts
```

## How It Works

1. **Upload** - User drops a PDF syllabus file
2. **Extract** - PDF is converted to base64 and sent to Groq for text extraction
3. **Analyze** - Extracted text is analyzed by GPT-OSS-20B to generate a structured roadmap
4. **Display** - Interactive modal shows course title, learning nodes with hours, and dependency edges

## API Integration

The app uses Groq's OpenAI-compatible API endpoint:
- Model: `openai/gpt-oss-20b`
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`

Two API calls are made:
1. **Text Extraction** - Extracts raw text from PDF base64
2. **Roadmap Generation** - Creates structured JSON roadmap from syllabus text

## License

MIT

Made for AI Conclave Hackathon@AJCE by
[Harikrishnan P S](https://github.com/Galahad-070/)
[Dyuthi S Sarath](https://github.com/dyuthiss)
[Anusree Babu](https://github.com/AnusreeBabu02)
