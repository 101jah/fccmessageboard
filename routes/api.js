"use strict";

const mongodb = require("mongodb");
const mongoose = require("mongoose");

module.exports = function (app) {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const replySchema = new mongoose.Schema({
    text: { type: String, required: true },
    delete_password: { type: String, required: true },
    created_on: { type: Date, default: Date.now },
    reported: { type: Boolean, default: false },
  });

  const threadSchema = new mongoose.Schema({
    text: { type: String, required: true },
    delete_password: { type: String, required: true },
    board: { type: String, required: true },
    created_on: { type: Date, default: Date.now },
    bumped_on: { type: Date, default: Date.now },
    reported: { type: Boolean, default: false },
    replies: [replySchema],
  });

  const Thread = mongoose.model("Thread", threadSchema);

  // POST request to create a new thread
  app.post("/api/threads/:board", async (req, res) => {
    const newThread = new Thread({
      text: req.body.text,
      delete_password: req.body.delete_password,
      board: req.params.board,
    });

    try {
      const savedThread = await newThread.save();
      res.redirect(`/b/${savedThread.board}/${savedThread._id}`);
    } catch (err) {
      console.log("Error saving thread:", err);
      res.status(500).send("Error saving thread");
    }
  });

  // POST request to create a new reply
  app.post("/api/replies/:board", async (req, res) => {
    const newReply = {
      text: req.body.text,
      delete_password: req.body.delete_password,
      created_on: new Date(),
      reported: false,
    };

    try {
      const updatedThread = await Thread.findByIdAndUpdate(
        req.body.thread_id,
        { $push: { replies: newReply }, bumped_on: new Date() },
        { new: true }
      );

      if (updatedThread) {
        res.redirect(
          `/b/${updatedThread.board}/${updatedThread._id}?new_reply_id=${newReply._id}`
        );
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (err) {
      console.log("Error updating thread with reply:", err);
      res.status(500).send("Error updating thread with reply");
    }
  });

  // GET request to fetch the most recent 10 bumped threads
  app.get("/api/threads/:board", async (req, res) => {
    try {
      const threads = await Thread.find({ board: req.params.board })
        .sort({ bumped_on: -1 })
        .limit(10)
        .lean()
        .exec();

      if (threads) {
        threads.forEach((thread) => {
          thread.replies = thread.replies
            .sort((a, b) => b.created_on - a.created_on)
            .slice(0, 3)
            .map((reply) => ({
              _id: reply._id,
              text: reply.text,
              created_on: reply.created_on,
            }));

          delete thread.delete_password;
          delete thread.reported;
        });

        res.json(threads);
      } else {
        res.status(404).send("No threads found");
      }
    } catch (err) {
      console.log("Error fetching threads:", err);
      res.status(500).send("Error fetching threads");
    }
  });

  // GET request to fetch an entire thread with all its replies
  app.get("/api/replies/:board", async (req, res) => {
    try {
      const thread = await Thread.findById(req.query.thread_id).lean();
      if (thread) {
        thread.replies.forEach((reply) => {
          delete reply.delete_password;
          delete reply.reported;
        });

        res.json({
          _id: thread._id,
          text: thread.text,
          created_on: thread.created_on,
          bumped_on: thread.bumped_on,
          replies: thread.replies,
        });
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (err) {
      console.log("Error fetching thread:", err);
      res.status(500).send("Error fetching thread");
    }
  });

  // DELETE request to delete a thread
  app.delete("/api/threads/:board", async (req, res) => {
    try {
      const thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        if (thread.delete_password === req.body.delete_password) {
          await Thread.findByIdAndDelete(req.body.thread_id);
          res.send("success");
        } else {
          res.send("incorrect password");
        }
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (err) {
      console.log("Error deleting thread:", err);
      res.status(500).send("Error deleting thread");
    }
  });

  // DELETE request to delete a reply
  app.delete("/api/replies/:board", async (req, res) => {
    try {
      const thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        const reply = thread.replies.id(req.body.reply_id);
        if (reply) {
          if (reply.delete_password === req.body.delete_password) {
            reply.text = "[deleted]";
            await thread.save();
            res.send("success");
          } else {
            res.send("incorrect password");
          }
        } else {
          res.status(404).send("Reply not found");
        }
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (err) {
      console.log("Error deleting reply:", err);
      res.status(500).send("Error deleting reply");
    }
  });

  // PUT request to report a thread
  app.put("/api/threads/:board", async (req, res) => {
    try {
      const thread = await Thread.findByIdAndUpdate(
        req.body.thread_id,
        { reported: true },
        { new: true }
      );
      if (thread) {
        res.send("reported");
      } else {
        res.status(404).send("Thread not found");
      }
    } catch (err) {
      console.log("Error reporting thread:", err);
      res.status(500).send("Error reporting thread");
    }
  });

  // PUT request to report a reply
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
    } catch (err) {
      console.log("Error reporting reply:", err);
      res.status(500).send("Error reporting reply");
    }
  });
};

