FROM node:24-alpine
WORKDIR /app
COPY bridge.mjs ./
USER node
EXPOSE 8788
CMD ["node","bridge.mjs"]
