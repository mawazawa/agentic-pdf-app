# Agentic PDF Form Filler

A visually stunning, minimalist system for automatically filling California court PDF forms using information extracted from donor documents.

![Form Filling Process](https://mermaid.ink/img/pako:eNqtlMFO4zAQhl_F8rmVnMY-oC8A2nKACBBcuFRO4hFWc9ysYwtWqO_Ouly2Igu7XKLYmvnnn8-eiX3o2J7s1V0N4BuEe7DdnuxQKV-5mK-9cY2N0GGFyZVvQQsdrHRYIriP5F7rYzpH0XtdWUJk2wDnYGsNj7CmK6KzDhv2ELpBkDk1ELSxIURg-4YYexvNw5x8oO-4zy32hfUlX5cA2jYWIe5hXb40XPbkgFWu3fE7Hm0bSKj2rHJrPO8u3yEj-XLsMXxMBzJq_tPOH03-Ug7jzfH4qcef7qGLnYscZYezE96yK7VLPQW9UNlUJCBUB46gEkVBOEkpT3NaFIrndVmQvPg0aw_dNk1QLssTxT5FSk3JnZQiz1mqxKzKZZnTLFF5qkaVJ7OVDiPAIIx-MwNbnN6OsZGJj_jBuqiHxN4b-YcZHGJDr1t6XxvQp-dvTNZj7_DaIvjXBpuU-IXCWRN3FrwwdYWFc25pJKFsqU3_IOTC4YuIbYeXcTxJVt8wzlPGZSlTIUZMkpxTpZSk-UxykSsy40wzmRUinaU0S_MaTD9-hO25DPr0aBKGDHxpzCQUkLHoR_5mEo5CaPfvjdDnhA3Qv4h5sQ0gxFhM9h8ufVSJ?type=png)

## Features

- **Intelligent Document Extraction**: Uses Perplexity Sonar API or OpenAI API to extract data from various document types
- **Smart Field Mapping**: Automatically maps extracted data to form fields
- **Beautiful UI**: Clean, minimalist interface for easy form processing
- **Docker-Based**: Simple deployment with Docker for both development and production
- **Modular Design**: Microservices architecture for maintainability and scalability

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- API keys for Perplexity and/or OpenAI

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agentic-pdf.git
cd agentic-pdf
```

2. Create an `.env` file in the root directory:
```
PERPLEXITY_API_KEY=your_perplexity_api_key
OPENAI_API_KEY=your_openai_api_key
```

3. Start the application in development mode:
```bash
docker-compose up --build
```

The services will be available at:
- UI: http://localhost:8080
- Orchestration Service API: http://localhost:3002
- Other microservices: ports 3000-3005

### Usage

1. Open http://localhost:8080 in your browser
2. Enter the URL of the California court form to fill (or use the default)
3. Upload supporting documents (ID cards, previous forms, etc.)
4. Wait for the system to process and fill the form
5. Download the completed form

## Architecture

This project follows a modern microservices architecture:

- **UI Layer** (Next.js): Provides a clean, responsive interface
- **MCP Servers** (Node.js/TypeScript): Implements Model Context Protocol servers for various services:
  - Puppeteer Server: Downloads PDFs from URLs
  - AI Analysis Server: Extracts form fields using AI vision
  - Document Extraction Server: Analyzes donor documents
  - Field Mapping Service: Maps donor data to form fields
  - Form Filling Server: Fills the PDF with mapped data
- **Orchestration Layer**: Coordinates the workflow between services

## Development

### Project Structure

```
agentic-pdf/
├── docker-compose.yml         # Main docker-compose configuration
├── docker-compose.override.yml # Development overrides
├── docker-compose.prod.yml    # Production configuration
├── nginx.conf                 # Nginx config for production
├── src/
│   └── mcp-servers/           # Backend services (TypeScript)
│       ├── src/
│       │   ├── config/        # Configuration
│       │   ├── orchestration/ # Workflow orchestrators
│       │   ├── servers/       # MCP server implementations
│       │   └── services/      # Service implementations
│       └── Dockerfile         # Multi-stage Dockerfile
└── ui/                        # Frontend (Next.js)
    ├── src/
    │   ├── components/        # React components
    │   ├── pages/             # Next.js pages
    │   └── styles/            # CSS styles
    └── Dockerfile             # Multi-stage Dockerfile
```

### Local Development

For local development with automatic reloading:

```bash
docker-compose up
```

### Production Deployment

For a production deployment:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Design Principles

This project adheres to several key design principles:

1. **Minimalism**: Clean interface and streamlined user experience
2. **Separation of Concerns**: Each component has a single, well-defined responsibility
3. **Visual Harmony**: Consistent use of typography, color, and space
4. **Progressive Disclosure**: Complexity is revealed only when needed
5. **Error Prevention**: Validation and clear user guidance

## License

MIT