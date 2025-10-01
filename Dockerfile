# Use official Node.js runtime as base image
FROM node:22-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

# Health check - verify bot is actually connected to Discord
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const fs=require('fs'); const file='/app/.bot-ready'; if(!fs.existsSync(file)) process.exit(1); const age=Date.now()-parseInt(fs.readFileSync(file)); if(age>60000) process.exit(1);" || exit 1

# Start the bot
CMD ["npm", "start"]
