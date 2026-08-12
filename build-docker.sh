#!/bin/bash

# Build script for LivePoster Docker image

echo "Building LivePoster Docker image..."
docker build -t liveposter:latest .

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Docker image built successfully!"
    echo ""
    echo "To run the container:"
    echo "  docker-compose up -d"
    echo ""
    echo "Or run directly:"
    echo "  docker run -d --name liveposter -p 3000:3000 -v ./cache:/app/.cache liveposter:latest"
    echo ""
    echo "Access the application at: http://localhost:3000"
else
    echo "✗ Build failed. Please check the error messages above."
    exit 1
fi
