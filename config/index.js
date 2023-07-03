require("dotenv").config();

const config = {
  SYNC_OUT_DIR: process.env.SYNC_OUT_DIR,
  SYNC_IN_DIR: process.env.SYNC_IN_DIR,
  REMOTE_URL: process.env.REMOTE_URL
};

module.exports = config;
