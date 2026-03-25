FROM node:20-slim

# Install Python for the Tab4U / Ultimate Guitar scrapers
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source (including the scrapers)
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
