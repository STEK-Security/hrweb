# Stage 1: Build the React app
FROM node:18-alpine AS builder

WORKDIR /usr/src/app/frontend

COPY package*.json ./

# npm ci is generally preferred if package-lock.json is accurate
# RUN npm ci
# Using npm install for now due to potential inconsistencies noted in previous steps with npm behavior
RUN npm install

COPY . .

# Set public URL, useful if app is not served from root
# ENV PUBLIC_URL=/
# Ensure the build script exists and works (from previous subtask fixes)
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:stable-alpine

# Copy built assets from the builder stage
COPY --from=builder /usr/src/app/frontend/build /usr/share/nginx/html

# Copy a custom Nginx configuration for client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
