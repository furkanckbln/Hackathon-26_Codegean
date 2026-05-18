# Stage 1: Build with Node
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

COPY . .

# Only VITE_ prefixed variables are accepted as build args.
# These are embedded into the JS bundle and visible in the browser.
# Never pass secret keys (SUPABASE_SERVICE_KEY, GEMINI_API_KEY) here.
ARG VITE_API_URL=http://localhost:8000
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Guard: fail the build if secret backend keys are present
RUN if [ -n "$SUPABASE_SERVICE_KEY" ] || [ -n "$GEMINI_API_KEY" ]; then \
      echo "ERROR: Secret backend key passed to frontend build!" && \
      exit 1; \
    fi

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Stage 2: Serve with Nginx
# Node, node_modules, source files and env vars are dropped here.
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
