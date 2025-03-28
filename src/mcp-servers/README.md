# Agentic PDF Form Field Extractor

A minimalist, user-centric system that downloads court PDF forms and extracts empty fields using AI vision APIs.

## Features

- PDF downloading via Puppeteer
- Form field extraction using Perplexity Sonar API or OpenAI Vision API
- Workflow orchestration for multi-step processing
- Clean, RESTful API for integration
- Stateful workflow tracking
- TypeScript implementation with robust error handling
- Scalable microservices architecture

## Architecture

![Architecture Diagram](https://mermaid.ink/img/pako:eNqNkk9PwzAMxb9KlHMR7cA1F0TZgQsHJA5oDunahtBfKU4ZQuW745SxdkMTHJPY7_nZz84Ea6MRpryxbFrTM0pHTRULB695pXGZGVcbuFK2caRbswLj5M41nWjpzRGFdSSM71O4qJneDqQXsIbMoYZXYgWb0vB_OQQnVNzTjPLPyuIYn-GtRofdLUa6XQWzP_pGa3uNHf7gOBjYYCMVttNwE6wNkmdmqxD1-XRG5H7Xtg4hGfnbIk6Gn1JsXwh5IPwPKfaTIi-KosjPBLPY5y6yjEFXBJf8jEwvOUQxOXHkPeEQxfTEQ-8JhyimJ07DEMdN0a5x0pTf45FzdmS82nIvX-R1XQV5-8SV_kLOMcUh7QWZEt-mHY0GGXPZWYuuTFMpqezRkXWGZAclt01N0smQ1YRtMjS8c-iBqR6dlFwRJOm3pTDnNWNfZ4aWSvqW4YvhVHZrqmxDadoJVt4nkp6O2_Ot0S5NH-ZkGbSWX1P8-7M?type=png)

The system follows a clean separation of concerns:

1. **Puppeteer Server**: Handles PDF downloading using Puppeteer
2. **AI Analysis Server**: Extracts form fields using Perplexity/OpenAI
3. **Orchestration Service**: Coordinates the workflow and exposes a unified API
4. **Workflow Orchestrator**: Manages the execution of multi-step workflows

## Prerequisites

- Node.js >= 16
- pnpm
- API keys for Perplexity Sonar or OpenAI

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agentic-pdf.git
cd agentic-pdf
```

2. Install dependencies:
```bash
cd src/mcp-servers
pnpm install
```

3. Configure environment:
```bash
cp .env.example .env
```

4. Update the `.env` file with your API keys:
```
PERPLEXITY_API_KEY=your_perplexity_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

Start the development servers:
```bash
pnpm dev
```

This starts three servers:
- Puppeteer Server: http://localhost:3000
- AI Analysis Server: http://localhost:3001
- Orchestration Service: http://localhost:3002

### API Endpoints

#### Orchestration Service (port 3002)

- `POST /workflow/pdf-analysis`: Start a PDF analysis workflow
  ```json
  {
    "pdfUrl": "https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv100.pdf",
    "analysisProvider": "perplexity",
    "filename": "dv100.pdf"
  }
  ```

- `GET /workflow/:workflowId`: Get workflow status and results
- `DELETE /workflow/:workflowId`: Clear workflow data
- `GET /status`: Get service status

#### Puppeteer Server (port 3000)

- `POST /download-pdf`: Download a PDF file
  ```json
  {
    "url": "https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv100.pdf",
    "filename": "dv100.pdf"
  }
  ```
- `GET /status`: Get server status

#### AI Analysis Server (port 3001)

- `POST /extract-fields`: Extract fields from a PDF
  ```json
  {
    "pdfPath": "/path/to/pdf/file.pdf",
    "provider": "perplexity",
    "options": {
      "max_tokens": 8192
    }
  }
  ```
- `GET /status`: Get server status

## Example Workflow

1. Start a PDF analysis workflow:
```bash
curl -X POST http://localhost:3002/workflow/pdf-analysis \
  -H "Content-Type: application/json" \
  -d '{"pdfUrl": "https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv100.pdf", "analysisProvider": "perplexity"}'
```

2. Check workflow status (replace with your workflowId):
```bash
curl http://localhost:3002/workflow/pdf-analysis-1634567890123
```

## Building for Production

Build the project:
```bash
pnpm build
```

Start production servers:
```bash
pnpm start
```

## Architecture Decisions

1. **Microservices**: Using separate servers for different concerns allows independent scaling and maintenance.
2. **Stateless Design**: Servers maintain minimal state, with workflow state managed by the orchestration layer.
3. **Async Processing**: Long-running workflows are processed asynchronously with status tracking.
4. **AI Provider Abstraction**: Support for multiple AI providers with consistent interfaces.
5. **Error Handling**: Comprehensive error handling and reporting at all levels.

## Security Considerations

- API keys are stored in environment variables only
- Input validation on all endpoints
- File path validation to prevent directory traversal
- Limited file system access
- Content type validation for downloads

## License

MIT