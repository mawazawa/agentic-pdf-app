FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install Python and required packages
RUN apk add --no-cache python3 py3-pip

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Development stage
FROM base AS development
RUN pnpm install

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 3000 3001 3002 3003 3004 3005
CMD ["pnpm", "dev"]

# Build stage
FROM base AS builder
RUN pnpm install
COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install Python and required packages
RUN apk add --no-cache python3 py3-pip

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/requirements.txt ./requirements.txt
COPY --from=builder /app/python ./python

# Install production dependencies only
RUN npm install -g pnpm && pnpm install --prod

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Create upload directories
RUN mkdir -p uploads/downloads uploads/donor-documents uploads/filled-forms

# Expose necessary ports
EXPOSE 3000 3001 3002 3003 3004 3005

# Start the application
CMD ["node", "dist/index.js"]