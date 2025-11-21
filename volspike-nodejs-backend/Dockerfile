FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema (needed for postinstall script)
COPY prisma ./prisma

# Install dependencies (including dev dependencies for build)
# This will run postinstall script which needs prisma/schema.prisma
RUN npm install

# Copy source code
COPY . .

# Build the application (Prisma client already generated in postinstall)
RUN npm run build

# Copy and set up entrypoint script BEFORE pruning
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Remove dev dependencies after build (but keep prisma for migrations)
RUN npm prune --omit=dev && npm install prisma --save-prod

# Expose port
EXPOSE 3001

# Use entrypoint script that runs migrations then starts server
ENTRYPOINT ["docker-entrypoint.sh"]
