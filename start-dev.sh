#!/bin/bash

# Start the development environment for Agentic PDF Form Filler

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp src/mcp-servers/.env.example .env
  echo "Please update the .env file with your API keys before continuing."
  exit 1
fi

# Make sure Docker is running
docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Docker does not seem to be running. Please start Docker and try again."
  exit 1
fi

# Build and start containers
echo "Building and starting Docker containers..."
docker-compose up --build

# Note: Use Ctrl+C to stop the containers