# Use official Node.js image (LTS version >=16)
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose port 3000 
EXPOSE 3000

# Default command to run the app
CMD ["npm", "start"]
