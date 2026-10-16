FROM node:24-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY bridge.mjs transport.mjs xtream-client.mjs media-engine.mjs provider-tls.mjs ./
USER node
EXPOSE 8788
CMD ["node","bridge.mjs"]
