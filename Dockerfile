FROM node:24-alpine

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set work directory to /service
WORKDIR /service

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy app source
COPY . .

USER node

# set your port
ENV PORT=2305

# expose the port to outside world
EXPOSE 2305

# start command as per package.json
CMD ["node", "src/index"]
