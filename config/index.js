require("dotenv").config();

const config = {
  SYNC_FROM_DIR: process.env.SYNC_FROM_DIR,
  SYNC_TO_DIR: process.env.SYNC_TO_DIR,
  PORT: process.env.PORT,
  REMOTE_URL: process.env.REMOTE_URL
};

module.exports = config;
