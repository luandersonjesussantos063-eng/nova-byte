FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY playable-timeshift.mjs real-source.mjs ./
COPY capacity/ ./capacity/
RUN node --check playable-timeshift.mjs && node --check real-source.mjs && node --check capacity/viewer-simulator.mjs && node --check capacity/staged-runner.mjs
ENV PORT=8800
EXPOSE 8800
CMD ["node", "playable-timeshift.mjs"]
