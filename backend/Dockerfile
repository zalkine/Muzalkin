FROM node:20-slim

# Install Python for the Tab4U scraper
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source (including the scraper)
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
