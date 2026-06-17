# Stage 1: Build Frontend (Angular)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependency files using exact casing
COPY FrontEnd/TeamUp/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY FrontEnd/TeamUp .
RUN npx ng build --configuration=production

# Stage 2: Build Backend (.NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-builder
WORKDIR /app/backend

# Copy backend project files and restore
COPY BackEnd/TeamUpBackEnd/TeamUpBackEnd.csproj .
RUN dotnet restore TeamUpBackEnd.csproj

# Copy backend source and publish
COPY BackEnd/TeamUpBackEnd .
RUN dotnet publish TeamUpBackEnd.csproj -c Release -o /app/backend/publish

# Stage 3: Runtime - Pure .NET 10 environment
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy published backend app directly into the working directory
COPY --from=backend-builder /app/backend/publish .

# Copy built Angular static files into the .NET wwwroot directory
# NOTE: If your build fails here, double-check your angular.json "outputPath" 
COPY --from=frontend-builder /app/frontend/dist/TeamUp/browser ./wwwroot

# Expose standard web port for cloud hosting
EXPOSE 8080

# Production environment configurations
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080

# Start the application
ENTRYPOINT ["dotnet", "TeamUpBackEnd.dll"]
