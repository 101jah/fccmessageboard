"use strict";
let mongodb = require("mongodb");
let mongoose = require("mongoose");
let express = require("express");
let bodyParser = require("body-parser");

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let uri = process.env.MONGO_URI || 'your_mongodb_uri_here';
console.log("Connecting to MongoDB with URI:", uri);

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

let replySchema = new mongoose.Schema({
  text: { type: String, required: true },
  delete_password: { type: String, required: true },
  created_on: { type: Date, required: true },
  reported: { type: Boolean, default: false },
  thread_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }
});

let threadSchema = new mongoose.Schema({
  text: { type: String, required: true },
  delete_password: { type: String, required: true },
  board: { type: String, required: true },
  created_on: { type: Date, required: true },
  bumped_on: { type: Date, required: true },
  reported: { type: Boolean, default: false },
  replies: [replySchema],
});

let Reply = mongoose.model("Reply", replySchema);
let Thread = mongoose.model("Thread", threadSchema);

app.post("/api/threads/:board", async (request, response) => {
  let newThread = new Thread(request.body);
  newThread.board = request.params.board;
  newThread.created_on = new Date();
  newThread.bumped_on = new Date();
  newThread.reported = false;
  newThread.replies = [];

  try {
    let savedThread = await newThread.save();
    console.log("Thread saved successfully:", savedThread);
    const baseUrl = `${request.protocol}://${request.get("host")}`;
    const redirectUrl = `${baseUrl}/b/${savedThread.board}/${savedThread._id}`;
    console.log("Redirecting to:", redirectUrl);
    response.redirect(redirectUrl);
  } catch (error) {
    console.log("Error saving thread:", error);
    response.status(500).send("Error saving thread");
  }
});

app.post("/api/replies/:board", async (request, response) => {
  if (!request.body.thread_id || !request.body.text || !request.body.delete_password) {
    return response.status(400).send("Thread ID, text, and delete password are required");
  }

  let newReply = new Reply({
    text: request.body.text,
    delete_password: request.body.delete_password,
    created_on: new Date(),
    reported: false,
    thread_id: request.body.thread_id
  });

  try {
    let updatedThread = await Thread.findByIdAndUpdate(
      request.body.thread_id,
      { $push: { replies: newReply }, bumped_on: new Date() },
      { new: true }
    );

    if (updatedThread) {
      const baseUrl = `${request.protocol}://${request.get("host")}`;
      const redirectUrl = `${baseUrl}/b/${updatedThread.board}/${updatedThread._id}?new_reply_id=${newReply._id}`;
      console.log("Redirecting to:", redirectUrl);
      response.redirect(redirectUrl);
    } else {
      response.status(404).send("Thread not found");
    }
  } catch (error) {
    console.log("Error updating thread with reply:", error);
    response.status(500).send("Error updating thread with reply");
  }
});

app.get("/api/threads/:board", async (request, response) => {
  try {
    let threads = await Thread.find({ board: request.params.board })
      .sort({ bumped_on: -1 })
      .limit(10)
      .lean();

    threads.forEach((thread) => {
      thread.replies = thread.replies
        .sort((a, b) => b.created_on - a.created_on)
        .slice(0, 3);
      delete thread.reported;
      delete thread.delete_password;
      thread.replies.forEach((reply) => {
        delete reply.reported;
        delete reply.delete_password;
      });
    });

    response.json(threads);
  } catch (error) {
    console.log("Error fetching threads:", error);
    response.status(500).send("Error fetching threads");
  }
});

app.get("/api/replies/:board", async (request, response) => {
  try {
    let thread = await Thread.findOne({
      _id: request.query.thread_id,
      board: request.params.board,
    }).lean();

    if (thread) {
      delete thread.reported;
      delete thread.delete_password;

      thread.replies.forEach((reply) => {
        delete reply.reported;
        delete reply.delete_password;
      });

      response.json(thread);
    } else {
      response.status(404).send("Thread not found");
    }
  } catch (error) {
    console.log("Error fetching thread:", error);
    response.status(500).send("Error fetching thread");
  }
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
