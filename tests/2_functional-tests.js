const chaiHttp = require("chai-http");
const chai = require("chai");
const assert = chai.assert;
const server = require("../server");

chai.use(chaiHttp);

suite("Functional Tests", function () {
  let thread_id;
  let reply_id;

  suite("API ROUTING FOR /api/threads/:board", function () {
    suite("POST", function () {
      test("Create a new thread", function (done) {
        chai
          .request(server)
          .post("/api/threads/testboard")
          .send({
            text: "Test thread text",
            delete_password: "password",
          })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.exists(res.redirects[0]);
            done();
          });
      });
    });

    suite("GET", function () {
      test("Get a list of threads", function (done) {
        chai
          .request(server)
          .get("/api/threads/testboard")
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.isArray(res.body);
            assert.property(res.body[0], "_id");
            assert.property(res.body[0], "text");
            assert.property(res.body[0], "created_on");
            assert.property(res.body[0], "bumped_on");
            assert.property(res.body[0], "replycount");
            assert.property(res.body[0], "replies");
            assert.isArray(res.body[0].replies);
            assert.isAtMost(res.body[0].replies.length, 3); // Ensure only 3 replies are returned
            thread_id = res.body[0]._id;
            done();
          });
      });
    });

    suite("DELETE", function () {
      test("Delete a thread", function (done) {
        chai
          .request(server)
          .delete("/api/threads/testboard")
          .send({
            thread_id: thread_id,
            delete_password: "password",
          })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, "success");
            done();
          });
      });

      test("Fail to delete a thread with incorrect password", function (done) {
        // Recreate the thread for this test
        chai
          .request(server)
          .post("/api/threads/testboard")
          .send({
            text: "Test thread text",
            delete_password: "password",
          })
          .end(function (err, res) {
            chai
              .request(server)
              .get("/api/threads/testboard")
              .end(function (err, res) {
                thread_id = res.body[0]._id;

                chai
                  .request(server)
                  .delete("/api/threads/testboard")
                  .send({
                    thread_id: thread_id,
                    delete_password: "wrongpassword",
                  })
                  .end(function (err, res) {
                    assert.equal(res.status, 200);
                    assert.equal(res.text, "incorrect password");
                    done();
                  });
              });
          });
      });
    });

    suite("PUT", function () {
      test("Report a thread", function (done) {
        // Recreate the thread for this test
        chai
          .request(server)
          .post("/api/threads/testboard")
          .send({
            text: "Test thread text",
            delete_password: "password",
          })
          .end(function (err, res) {
            chai
              .request(server)
              .get("/api/threads/testboard")
              .end(function (err, res) {
                thread_id = res.body[0]._id;

                chai
                  .request(server)
                  .put("/api/threads/testboard")
                  .send({
                    thread_id: thread_id,
                  })
                  .end(function (err, res) {
                    assert.equal(res.status, 200);
                    assert.equal(res.text, "reported");
                    done();
                  });
              });
          });
      });
    });
  });

  suite("API ROUTING FOR /api/replies/:board", function () {
    suite("POST", function () {
      test("Create a new reply", function (done) {
        chai
          .request(server)
          .post("/api/threads/testboard")
          .send({
            text: "Thread for replies",
            delete_password: "password",
          })
          .end(function (err, res) {
            chai
              .request(server)
              .get("/api/threads/testboard")
              .end(function (err, res) {
                thread_id = res.body[0]._id;

                chai
                  .request(server)
                  .post("/api/replies/testboard")
                  .send({
                    thread_id: thread_id,
                    text: "Test reply text",
                    delete_password: "password",
                  })
                  .end(function (err, res) {
                    assert.equal(res.status, 200);
                    assert.exists(res.redirects[0]);
                    done();
                  });
              });
          });
      });
    });

    suite("GET", function () {
      test("Get a thread with all replies", function (done) {
        chai
          .request(server)
          .get("/api/replies/testboard")
          .query({ thread_id: thread_id })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.property(res.body, "text");
            assert.property(res.body, "created_on");
            assert.property(res.body, "bumped_on");
            assert.property(res.body, "replies");
            assert.isArray(res.body.replies);
            reply_id = res.body.replies[0]._id;
            done();
          });
      });
    });

    suite("DELETE", function () {
      test("Delete a reply", function (done) {
        chai
          .request(server)
          .delete("/api/replies/testboard")
          .send({
            thread_id: thread_id,
            reply_id: reply_id,
            delete_password: "password",
          })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, "success");
            done();
          });
      });

      test("Fail to delete a reply with incorrect password", function (done) {
        chai
          .request(server)
          .delete("/api/replies/testboard")
          .send({
            thread_id: thread_id,
            reply_id: reply_id,
            delete_password: "wrongpassword",
          })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, "incorrect password");
            done();
          });
      });
    });

    suite("PUT", function () {
      test("Report a reply", function (done) {
        chai
          .request(server)
          .put("/api/replies/testboard")
          .send({
            thread_id: thread_id,
            reply_id: reply_id,
          })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, "reported");
            done();
          });
      });
    });
  });
});
