FROM node:14-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV BOARD_PORT=3000
ENV BOARD_DB=mongodb://root:example@localhost:27017/?poolSize=20&w=majority
EXPOSE ${PORT}
CMD ["npm", "start"]
