#!/bin/bash

# Deploy the Agentic PDF Form Filler to production

# Check if .env file exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Please create a .env file with your API keys."
  exit 1
fi

# Make sure Docker is running
docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Docker does not seem to be running. Please start Docker and try again."
  exit 1
fi

# Build and start production containers
echo "Building and starting production Docker containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

echo ""
echo "Production deployment complete!"
echo "The application should be available at http://localhost (port 80)"
echo "To view logs: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "To stop: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down"