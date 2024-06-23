"use strict";
const express = require("express");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

module.exports = function (app) {
  const uri = process.env.MONGO_URI;
  console.log("Connecting to MongoDB with URI:", uri);

  mongoose
    .connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.log("MongoDB connection error:", err));

  // Security middleware
  app.use(helmet());
  app.use(helmet.frameguard({ action: "sameorigin" }));
  app.use(helmet.dnsPrefetchControl({ allow: false }));
  app.use(helmet.referrerPolicy({ policy: "same-origin" }));

  // Body parser middleware
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  const replySchema = new mongoose.Schema({
    text: { type: String, required: true },
    delete_password: { type: String, required: true },
    created_on: { type: Date, required: true },
    reported: { type: Boolean, required: true },
  });

  const threadSchema = new mongoose.Schema({
    text: { type: String, required: true },
    delete_password: { type: String, required: true },
    board: { type: String, required: true },
    created_on: { type: Date, required: true },
    bumped_on: { type: Date, required: true },
    reported: { type: Boolean, required: true },
    replies: [replySchema],
  });

  const Reply = mongoose.model("Reply", replySchema);
  const Thread = mongoose.model("Thread", threadSchema);

  // Create a new thread
  app.post("/api/threads/:board", async (req, res) => {
    const newThread = new Thread({
      text: req.body.text,
      delete_password: req.body.delete_password,
      board: req.params.board,
      created_on: new Date(),
      bumped_on: new Date(),
      reported: false,
      replies: [],
    });

    try {
      const savedThread = await newThread.save();
      console.log("Thread saved successfully:", savedThread);
      res.redirect(`/b/${savedThread.board}/${savedThread._id}`);
    } catch (error) {
      console.log("Error saving thread:", error);
      res.status(500).send("Error saving thread");
    }
  });

  // Create a new reply
  app.post("/api/replies/:board", async (req, res) => {
    const newReply = {
      _id: new mongoose.Types.ObjectId(),
      text: req.body.text,
      delete_password: req.body.delete_password,
      created_on: new Date(),
      reported: false,
    };

    try {
      const updatedThread = await Thread.findByIdAndUpdate(
        req.body.thread_id,
        {
          $push: { replies: newReply },
          $set: { bumped_on: new Date() },
        },
        { new: true }
      );

      if (updatedThread) {
        res.redirect(`/b/${updatedThread.board}/${updatedThread._id}?new_reply_id=${newReply._id}`);
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (error) {
      console.log("Error updating thread with reply:", error);
      res.status(500).send("Error updating thread with reply");
    }
  });

  // Get the most recent 10 threads
  app.get("/api/threads/:board", async (req, res) => {
    try {
      const threads = await Thread.find({ board: req.params.board })
        .sort({ bumped_on: -1 })
        .limit(10)
        .lean();

      threads.forEach(thread => {
        thread.replies = thread.replies.slice(-3);
        delete thread.reported;
        delete thread.delete_password;
        thread.replies.forEach(reply => {
          delete reply.reported;
          delete reply.delete_password;
        });
      });

      res.json(threads);
    } catch (error) {
      console.log("Error fetching threads:", error);
      res.status(500).send("Error fetching threads");
    }
  });

  // Get a specific thread with all replies
  app.get("/api/replies/:board", async (req, res) => {
    try {
      const thread = await Thread.findOne({
        _id: req.query.thread_id,
        board: req.params.board,
      }).lean();

      if (thread) {
        delete thread.reported;
        delete thread.delete_password;
        thread.replies.forEach(reply => {
          delete reply.reported;
          delete reply.delete_password;
        });
        res.json(thread);
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (error) {
      console.log("Error fetching thread:", error);
      res.status(500).send("Error fetching thread");
    }
  });

  // Delete a thread
  app.delete("/api/threads/:board", async (req, res) => {
    try {
      const thread = await Thread.findById(req.body.thread_id);
      if (thread && thread.delete_password === req.body.delete_password) {
        await thread.remove();
        res.send("success");
      } else {
        res.send("incorrect password");
      }
    } catch (error) {
      console.log("Error deleting thread:", error);
      res.status(500).send("Error deleting thread");
    }
  });

  // Delete a reply
  app.delete("/api/replies/:board", async (req, res) => {
    try {
      const thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        const reply = thread.replies.id(req.body.reply_id);
        if (reply && reply.delete_password === req.body.delete_password) {
          reply.text = "[deleted]";
          await thread.save();
          res.send("success");
        } else {
          res.send("incorrect password");
        }
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (error) {
      console.log("Error deleting reply:", error);
      res.status(500).send("Error deleting reply");
    }
  });

  // Report a thread
  app.put("/api/threads/:board", async (req, res) => {
    try {
      await Thread.findByIdAndUpdate(req.body.thread_id, { reported: true });
      res.send("reported");
    } catch (error) {
      console.log("Error reporting thread:", error);
      res.status(500).send("Error reporting thread");
    }
  });

  // Report a reply
  app.put("/api/replies/:board", async (req, res) => {
    try {
      const thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        const reply = thread.replies.id(req.body.reply_id);
        if (reply) {
          reply.reported = true;
          await thread.save();
          res.send("reported");
        } else {
          res.status(404).send("Reply not found");
        }
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (error) {
      console.log("Error reporting reply:", error);
      res.status(500).send("Error reporting reply");
    }
  });
};
