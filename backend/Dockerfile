FROM node:20-slim

# Install Python for the Tab4U / Ultimate Guitar scrapers
RUN apt-get update && apt-get install -y python3 python3-venv && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a Python venv and install scraper dependencies
COPY requirements.txt ./
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --upgrade pip && /opt/venv/bin/pip install -r requirements.txt

# Make venv python the default for CMD/RUN
ENV PATH="/opt/venv/bin:$PATH"

# Install Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source (including the scrapers)
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
