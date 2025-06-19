# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app/backend

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
# Ensure package-lock.json is up-to-date for 'npm ci'
COPY package*.json ./

# Install app dependencies
# Using --only=production to avoid installing devDependencies
# If package-lock.json is not perfectly in sync, 'npm install --production' might be more forgiving.
# However, 'npm ci' is generally preferred for CI/Docker if lock file is maintained.
RUN npm ci --only=production

# Bundle app source
COPY . .

# Make port available to the world outside this container
# Note: EXPOSE doesn't publish the port, 'ports' in docker-compose does.
# This is more for documentation or inter-container communication setup.
EXPOSE ${BACKEND_PORT:-5000}

# Define environment variable (can be overridden by docker-compose)
# NODE_ENV=production is good practice for performance and security.
ENV NODE_ENV=production
# PORT will be used by server.js to listen on the correct port.
# It defaults here but should be set by docker-compose via .env.
ENV PORT=${BACKEND_PORT:-5000}

# Run the app when the container launches
CMD ["node", "server.js"]
