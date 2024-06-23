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
    created_on: { type: Date, required: true },
    reported: { type: Boolean, required: true, default: false },
  });

  const threadSchema = new mongoose.Schema({
    text: { type: String, required: true },
    delete_password: { type: String, required: true },
    board: { type: String, required: true },
    created_on: { type: Date, required: true, default: Date.now },
    bumped_on: { type: Date, required: true, default: Date.now },
    reported: { type: Boolean, required: true, default: false },
    replies: [replySchema],
  });

  const Thread = mongoose.model("Thread", threadSchema);

  // POST request to create a new thread
  app.post("/api/threads/:board", async (req, res) => {
    let newThread = new Thread(req.body);
    newThread.board = req.params.board;
    newThread.created_on = new Date();
    newThread.bumped_on = new Date();
    newThread.reported = false;
    newThread.replies = [];

    try {
      let savedThread = await newThread.save();
      if (savedThread) {
        return res.redirect("/b/" + savedThread.board + "/" + savedThread._id);
      }
    } catch (err) {
      console.log(err);
    }
  });

  // POST request to create a new reply
  app.post("/api/replies/:board", async (req, res) => {
    let newReply = {
      text: req.body.text,
      delete_password: req.body.delete_password,
      created_on: new Date(),
      reported: false,
    };

    try {
      let updatedThread = await Thread.findByIdAndUpdate(
        req.body.thread_id,
        { $push: { replies: newReply }, bumped_on: new Date() },
        { new: true },
      );
      if (updatedThread) {
        return res.redirect(
          "/b/" +
            updatedThread.board +
            "/" +
            updatedThread._id +
            "?new_reply_id=" +
            newReply._id,
        );
      }
    } catch (err) {
      console.log(err);
    }
  });

  // GET request to fetch the most recent 10 bumped threads
  app.get("/api/threads/:board", async (req, res) => {
    try {
      let threads = await Thread.find({ board: req.params.board })
        .sort({ bumped_on: -1 })
        .limit(10)
        .lean()
        .exec();

      if (threads) {
        threads.forEach((thread) => {
          thread.replycount = thread.replies.length; // Adding replycount property
          thread.replies = thread.replies
            .sort((a, b) => b.created_on - a.created_on)
            .slice(0, 3)
            .map((reply) => ({
              _id: reply._id,
              text: reply.text,
              created_on: reply.created_on,
            }));

          // Removing fields that should not be sent to the client
          delete thread.delete_password;
          delete thread.reported;
        });

        console.log("Threads response:", threads); // Logging response
        return res.json(threads);
      }
    } catch (err) {
      console.log(err);
    }
  });

  // GET request to fetch an entire thread with all its replies
  app.get("/api/replies/:board", async (req, res) => {
    try {
      let thread = await Thread.findById(req.query.thread_id).lean();
      if (thread) {
        thread.replies.forEach((reply) => {
          delete reply.delete_password;
          delete reply.reported;
        });

        return res.json({
          _id: thread._id,
          text: thread.text,
          created_on: thread.created_on,
          bumped_on: thread.bumped_on,
          replies: thread.replies,
        });
      } else {
        return res.send("Thread not found");
      }
    } catch (err) {
      console.log(err);
    }
  });

  // DELETE request to delete a thread
  app.delete("/api/threads/:board", async (req, res) => {
    try {
      let thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        if (thread.delete_password === req.body.delete_password) {
          await Thread.findByIdAndDelete(req.body.thread_id);
          return res.send("success");
        } else {
          return res.send("incorrect password");
        }
      } else {
        return res.send("Thread not found");
      }
    } catch (err) {
      console.log(err);
    }
  });

  // DELETE request to delete a reply
  app.delete("/api/replies/:board", async (req, res) => {
    try {
      let thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        let reply = thread.replies.id(req.body.reply_id);
        if (reply) {
          if (reply.delete_password === req.body.delete_password) {
            reply.text = "[deleted]";
            let updatedThread = await thread.save();
            if (updatedThread) {
              return res.send("success");
            }
          } else {
            return res.send("incorrect password");
          }
        } else {
          return res.send("Reply not found");
        }
      } else {
        return res.send("Thread not found");
      }
    } catch (err) {
      console.log(err);
    }
  });

  // PUT request to report a thread
  app.put("/api/threads/:board", async (req, res) => {
    try {
      let thread = await Thread.findByIdAndUpdate(
        req.body.thread_id,
        { reported: true },
        { new: true },
      );
      if (thread) {
        return res.send("reported");
      } else {
        return res.send("Thread not found");
      }
    } catch (err) {
      console.log(err);
    }
  });

  // PUT request to report a reply
  app.put("/api/replies/:board", async (req, res) => {
    try {
      let thread = await Thread.findById(req.body.thread_id);
      if (thread) {
        let reply = thread.replies.id(req.body.reply_id);
        if (reply) {
          reply.reported = true;
          let updatedThread = await thread.save();
          if (updatedThread) {
            return res.send("reported");
          }
        } else {
          return res.send("Reply not found");
        }
      } else {
        return res.send("Thread not found");
      }
    } catch (err) {
      console.log(err);
    }
  });
};
