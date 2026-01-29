FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install  

# Copy the rest of the application
COPY . .

# Expose port (if your app runs on port 3000)
EXPOSE 3000

# Start the application

CMD [ "sh", "-c", "npm run seed:all && npm run start" ]

# Migration command
# RUN npm run migratePro 