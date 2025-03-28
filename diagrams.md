# System Architecture Diagrams

## Class Diagram

This diagram shows the main components of the system and their relationships:

```mermaid
classDiagram
    class User {
      +upload(donorDocuments)
      +selectForm(formUrl)
      +startWorkflow()
      +downloadFilledForm()
    }

    class NextjsUI {
      -activeStep: number
      -workflowId: string
      -formUrl: string
      -donorDocs: string[]
      -resultUrl: string
      +handleStartWorkflow()
      +pollWorkflowStatus()
      +handleReset()
    }

    class OrchestrationService {
      -servers: ServerEndpoint[]
      -workflowCache: Map
      +runFormFillingWorkflow()
      +getWorkflowResult()
      +clearWorkflowCache()
    }

    class PuppeteerServer {
      +downloadPdf(url, options)
      +statusHandler()
    }

    class AIAnalysisServer {
      -perplexityConfig: ApiConfig
      -openaiConfig: ApiConfig
      +extractFormFields(pdfPath, provider)
      +statusHandler()
    }

    class DocumentExtractionServer {
      -perplexityConfig: ApiConfig
      -openaiConfig: ApiConfig
      +uploadDocument(file)
      +extractData(documentPath, options)
      +statusHandler()
    }

    class FieldMappingService {
      -confidenceThreshold: number
      +mapFields(formFields, donorData, confidence)
      +statusHandler()
    }

    class FormFillingServer {
      -outputDir: string
      +fillForm(formPath, formData, outputFilename)
      +statusHandler()
    }

    User --> NextjsUI : interacts with
    NextjsUI --> OrchestrationService : API requests
    OrchestrationService --> PuppeteerServer : downloads PDF
    OrchestrationService --> AIAnalysisServer : extracts fields
    OrchestrationService --> DocumentExtractionServer : analyzes documents
    OrchestrationService --> FieldMappingService : maps data to fields
    OrchestrationService --> FormFillingServer : fills form
    NextjsUI ..> User : provides filled form
```

## Workflow Sequence Diagram

This diagram illustrates the step-by-step workflow in the system:

```mermaid
sequenceDiagram
    participant User
    participant UI as NextJS UI
    participant Orch as Orchestration Service
    participant PDF as Puppeteer Server
    participant AI as AI Analysis Server
    participant Doc as Document Extraction Server
    participant Map as Field Mapping Service
    participant Fill as Form Filling Server

    User->>UI: 1. Enter Form URL
    User->>UI: 2. Upload Donor Documents
    UI->>Doc: 3. Upload documents
    Doc-->>UI: Return document paths
    User->>UI: 4. Click "Process"

    UI->>Orch: 5. Start form filling workflow
    Orch->>PDF: 6. Download PDF form
    PDF-->>Orch: Return form path

    Orch->>AI: 7. Extract form fields
    AI-->>Orch: Return form fields

    Orch->>Doc: 8. Extract data from donor docs
    Doc-->>Orch: Return extracted data

    Orch->>Map: 9. Map donor data to form fields
    Map-->>Orch: Return mapped fields

    Orch->>Fill: 10. Fill form with mapped data
    Fill-->>Orch: Return filled form path

    Orch-->>UI: 11. Return workflow result
    UI->>User: 12. Display filled form
    User->>UI: 13. Download filled form
    UI-->>User: Deliver filled form PDF
```

## User Empathy Map

This diagram helps understand the user's perspective and needs:

```mermaid
mindmap
  root((User Filling Court Forms))
    (Thinks/Feels)
      [Overwhelmed by complex legal forms]
      [Worried about making mistakes]
      [Concerned about meeting deadlines]
      [Uncertain if they have right documents]
      [Hopeful for simpler solution]
    (Says/Does)
      [Asks for help understanding requirements]
      [Searches for form online]
      [Gathers personal documents]
      [Manually fills out fields]
      [Makes errors in form completion]
      [Asks for review before submission]
    (Hears)
      [Legal jargon is confusing]
      [Forms take a long time to fill out]
      [Missing information can delay case]
      [Some fields are unnecessary for their case]
    (Sees)
      [Many required fields]
      [Complex instructions]
      [Other people struggling with same forms]
      [Limited assistance options]
    (Pain Points)
      ["Which information goes where?"]
      [Time-consuming process]
      [Potential for errors]
      [Difficulty understanding requirements]
      [Stress about consequences of mistakes]
    (Gains)
      [Automated form filling]
      [Time savings]
      [Error reduction]
      [Confidence in accuracy]
      [Simple, guided workflow]
```

## Docker Deployment Architecture

This diagram shows the Docker container architecture:

```mermaid
graph TD
    subgraph "Docker Environment"
        client[Client Browser] -- HTTP/HTTPS --> nginx[Nginx Proxy]

        subgraph "Frontend"
            nginx --> ui[Next.js UI Container]
        end

        subgraph "Backend Services"
            nginx -- /api/* --> orch[Orchestration Service]
            orch --> puppeteer[Puppeteer Server]
            orch --> ai[AI Analysis Server]
            orch --> doc[Document Extraction Server]
            orch --> map[Field Mapping Service]
            orch --> fill[Form Filling Server]
        end

        subgraph "Shared Volumes"
            puppeteer -- writes to --> vol1[Uploads Volume]
            doc -- writes to --> vol1
            fill -- writes to --> vol1
            fill -- reads from --> vol1
        end
    end

    subgraph "External Services"
        puppeteer --> ext1[Court Websites]
        ai --> ext2[Perplexity API]
        ai --> ext3[OpenAI API]
        doc --> ext2
        doc --> ext3
    end

    style client fill:#f9f9f9,stroke:#333,stroke-width:1px
    style nginx fill:#dff5ff,stroke:#333,stroke-width:1px
    style ui fill:#d4f9d4,stroke:#333,stroke-width:1px
    style orch fill:#ffe6cc,stroke:#333,stroke-width:1px
    style puppeteer fill:#ffe6cc,stroke:#333,stroke-width:1px
    style ai fill:#ffe6cc,stroke:#333,stroke-width:1px
    style doc fill:#ffe6cc,stroke:#333,stroke-width:1px
    style map fill:#ffe6cc,stroke:#333,stroke-width:1px
    style fill fill:#ffe6cc,stroke:#333,stroke-width:1px
    style vol1 fill:#e6e6e6,stroke:#333,stroke-width:1px
    style ext1 fill:#f9d9d9,stroke:#333,stroke-width:1px
    style ext2 fill:#f9d9d9,stroke:#333,stroke-width:1px
    style ext3 fill:#f9d9d9,stroke:#333,stroke-width:1px
```