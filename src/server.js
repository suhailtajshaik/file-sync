// require("dotenv").config();
const config = require("../config");
const watch = require("node-watch");
const fetch = require("node-fetch");
const nodePath = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const FormData = require("form-data");

const upload = multer({ dest: "uploads/" });
const app = express();

const SYNC_FROM_DIR = config.SYNC_FROM_DIR;
const SYNC_TO_DIR = config.SYNC_TO_DIR;
const createFolder = (folderName) => {
  // Check if folder exists else create folder
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
};

createFolder(SYNC_FROM_DIR);
createFolder(SYNC_TO_DIR);

watch(SYNC_FROM_DIR, { recursive: false }, async (evt, name) => {
  const file = fs.createReadStream(name);

  const form = new FormData();
  form.append("file", file);

  await fetch(`${process.env.REMOTE_URL}/files`, {
    method: "POST",
    body: form
  });

  fs.unlinkSync(name);
});

app.post("/files", upload.single("file"), function (req, res, next) {
  const { originalname, path } = req.file;
  const file = fs.readFileSync(path);
  fs.writeFileSync(nodePath.join(SYNC_TO_DIR, originalname), file);
  fs.unlinkSync(path);
  console.log("synced sucessfully!");
  res.status(200);
  res.send("success");
});

app.listen(config.PORT);
