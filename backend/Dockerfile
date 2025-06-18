
# backend/Dockerfile

FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --only=production

# Copy everything else (including ./frontend)
COPY . .

# Expose the port (must match your server.js PORT)
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
