FROM node:20-bookworm-slim

# System dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       git \
       ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# -----------------------
# MCP SERVER (BAKED)
# -----------------------
WORKDIR /app

# Install MCP server dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy MCP server source
COPY src ./src

ENV NODE_ENV=production

# -----------------------
# DEV WORKSPACE (RUNTIME)
# -----------------------
WORKDIR /workspace

# Add entrypoint for runtime workspace initialization
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
