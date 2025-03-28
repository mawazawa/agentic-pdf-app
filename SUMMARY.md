# Agentic PDF Form Filler - Project Summary

## System Overview

The Agentic PDF Form Filler is a Docker-based application that automates the filling of California court forms using information extracted from donor documents (IDs, licenses, other forms, etc.). It uses AI vision APIs to analyze both the form fields and donor documents, then intelligently maps the extracted data to fill the form.

## Architecture Highlights

1. **Docker-based Deployment**
   - Development and production environments configured via Docker Compose
   - Multi-stage Dockerfiles for efficient builds
   - Nginx reverse proxy for production deployment

2. **Microservices Architecture**
   - **Puppeteer Server**: Downloads PDF forms from URLs
   - **AI Analysis Server**: Extracts form fields using Perplexity/OpenAI
   - **Document Extraction Server**: Analyzes donor documents to extract data
   - **Field Mapping Service**: Maps donor data to form fields
   - **Form Filling Server**: Fills the form with mapped data
   - **Orchestration Service**: Coordinates workflow between services

3. **Modern UI**
   - Next.js frontend with TypeScript
   - TailwindCSS for styling
   - Responsive, minimalist design
   - Step-by-step workflow with progress indicators

## Key Features

1. **Intelligent Document Processing**
   - Multiple donor document support (IDs, previous forms, etc.)
   - AI-powered field extraction and mapping
   - Confidence scoring for field mapping
   - Support for various document types (PDF, images, etc.)

2. **User-Centric Design**
   - Simple drag-and-drop file upload
   - Clear workflow progress indicators
   - Validation at each step
   - One-click form download

3. **Flexible Configuration**
   - Multiple AI providers (Perplexity, OpenAI)
   - Configurable confidence thresholds
   - Support for different form types

## Development

The project is organized for efficient development:

- **Docker Compose** for local development with hot reloading
- **TypeScript** throughout for type safety
- **MCP Server Pattern** for consistent microservice implementation
- **Comprehensive documentation** including architecture diagrams

## Deployment

Two deployment options are provided:

1. **Development**: `./start-dev.sh`
   - Live-reloading for both frontend and backend
   - Direct access to service ports for debugging

2. **Production**: `./deploy-prod.sh`
   - Optimized builds
   - Nginx reverse proxy
   - Container health monitoring

## Future Enhancements

1. **Integration with Court Systems**
   - Direct form submission capabilities
   - Integration with e-filing systems

2. **Advanced Data Extraction**
   - Support for more document types
   - Improved field extraction accuracy
   - Advanced field type detection

3. **User Management**
   - Account creation for saving documents and forms
   - History of previously filled forms
   - Document templates and saved information

## Repository Structure

```
agentic-pdf/
├── docker-compose.yml         # Main Docker Compose configuration
├── docker-compose.override.yml # Development overrides
├── docker-compose.prod.yml    # Production configuration
├── nginx.conf                 # Nginx configuration for production
├── start-dev.sh               # Development startup script
├── deploy-prod.sh             # Production deployment script
├── diagrams.md                # System architecture diagrams
├── README.md                  # Project documentation
├── src/
│   └── mcp-servers/           # Backend services (TypeScript)
│       ├── src/
│       │   ├── config/        # Configuration
│       │   ├── orchestration/ # Workflow orchestration
│       │   ├── servers/       # MCP server implementations
│       │   └── services/      # Service implementations
│       └── Dockerfile         # Multi-stage Dockerfile for backend
└── ui/                        # Frontend (Next.js)
    ├── src/
    │   ├── components/        # React components
    │   ├── pages/             # Next.js pages/routes
    │   └── styles/            # CSS styles
    └── Dockerfile             # Multi-stage Dockerfile for frontend
```

## Getting Started

To start using the system:

1. Clone the repository: `git clone https://github.com/yourusername/agentic-pdf.git`
2. Create an `.env` file with API keys: `cp src/mcp-servers/.env.example .env`
3. Update the `.env` file with your Perplexity and/or OpenAI API keys
4. Run the development environment: `./start-dev.sh`
5. Access the UI at http://localhost:8080