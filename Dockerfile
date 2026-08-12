# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create cache directory
RUN mkdir -p .cache

# Expose port
EXPOSE 3000

# Set environment variables defaults
ENV NODE_ENV=production \
    PORT=3000

# Start the application
CMD ["node", "server.js"]
