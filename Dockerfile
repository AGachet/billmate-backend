####################
# Stage 1: Builder #
####################
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files separately for better caching
COPY package.json ./
COPY package-lock.json ./
COPY prisma ./prisma

# Install dependencies and generate Prisma client
RUN npm ci
RUN npx prisma generate

# Copy source code
COPY . .

# Build application
RUN npm run build

# Clean up Prisma after build
RUN rm -rf prisma


###################
# Stage 2: Runner #
###################
FROM node:22-alpine AS runner
WORKDIR /app

# Add labels only in the final image
LABEL org.opencontainers.image.source="https://github.com/agachet/billmate-backend"
LABEL org.opencontainers.image.description="BillMate Backend API"
LABEL org.opencontainers.image.licenses="MIT"

# Install necessary runtime dependencies and build tools
RUN apk add --no-cache postgresql-client dumb-init python3 make g++

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy package files separately for better caching
COPY package.json ./
COPY package-lock.json ./
COPY prisma ./prisma

# Install dependencies and copy Prisma client from builder
RUN npm ci --omit=dev --ignore-scripts && npm rebuild bcrypt --build-from-source
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3500

# Create necessary directories with proper permissions
RUN mkdir -p logs docs && chown -R nestjs:nodejs logs docs

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
  CMD wget --quiet --tries=1 --spider http://localhost:$PORT/api/health || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]