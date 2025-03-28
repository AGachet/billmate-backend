#########################
# Stage 1: Dependencies #
#########################
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate


####################
# Stage 2: Builder #
####################
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Build application
RUN npm run build


###################
# Stage 3: Runner #
###################
FROM node:22-alpine AS runner
WORKDIR /app

# Add labels only in the final image
LABEL org.opencontainers.image.source="https://github.com/agachet/billmate-backend"
LABEL org.opencontainers.image.description="BillMate Backend API"
LABEL org.opencontainers.image.licenses="MIT"

# Install necessary runtime dependencies
RUN apk add --no-cache postgresql-client dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy built application and dependencies
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=deps --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Install production dependencies only
ENV HUSKY=0
RUN npm ci --omit=dev

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