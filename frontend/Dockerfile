FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY meowsenger-frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy all files (the .env.local file will be ignored due to .dockerignore)
COPY meowsenger-frontend/ ./

# Copy the .env file
COPY meowsenger-frontend/.env ./

# Build the Next.js app
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]