# Stage 1: Build Frontend (Angular)
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY FrontEnd/TeamUp/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY FrontEnd/TeamUp .

# Build Angular app (production)
RUN npm run build

# Stage 2: Build Backend (.NET)
FROM mcr.microsoft.com/dotnet/sdk:10 AS backend-builder

WORKDIR /app/backend

# Copy backend project files
COPY BackEnd/TeamUpBackEnd/TeamUpBackEnd.csproj .

# Restore dependencies
RUN dotnet restore TeamUpBackEnd.csproj

# Copy backend source
COPY BackEnd/TeamUpBackEnd .

# Build and publish
RUN dotnet publish TeamUpBackEnd.csproj -c Release -o /app/backend/publish

# Stage 3: Runtime - Run both services
FROM mcr.microsoft.com/dotnet/aspnet:10 AS runtime

# Install Node.js for serving frontend (if needed) and other utilities
RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy published backend from builder
COPY --from=backend-builder /app/backend/publish ./backend

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/frontend/dist/TeamUp/browser ./backend/wwwroot

# Set working directory to backend
WORKDIR /app/backend

# Create a startup script that handles both services
RUN echo '#!/bin/bash\n\
echo "Starting TeamUp application..."\n\
echo "Backend running on: $BACKEND_URL or https://localhost:7094"\n\
echo "Frontend will be served from backend at: $FRONTEND_URL or http://localhost:4200"\n\
\n\
# Start the backend (which will serve the frontend)\n\
exec dotnet TeamUpBackEnd.dll' > /app/startup.sh

RUN chmod +x /app/startup.sh

# Expose ports
EXPOSE 7094 4200

# Environment variables (can be overridden at runtime)
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=https://+:7094 \
    ASPNETCORE_Kestrel__Certificates__Default__Path=/app/backend/cert.pem \
    ASPNETCORE_Kestrel__Certificates__Default__KeyPath=/app/backend/key.pem

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7094/health || exit 1

# Run the backend
CMD ["dotnet", "TeamUpBackEnd.dll"]
