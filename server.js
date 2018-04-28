const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const fs = require("fs");
const uniqid = require("uniqid");

/********* ROUTES *********/
// I delibaretely read this file syncronously. This will only happen before
// server is live and accepting trafic. It's therefor actually wanted for
// node to wait for this file until going online
var messages = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));

// Public files
app.use(express.static("public"));

// Get existing messages
app.get("/messages", (req, res) => {
  res.json(messages);
});

/********* SOCKETS *********/

// Holds information about how many users are connected right now
var connectedUsers = 0;

// Event that fires when a user connects
io.on("connection", socket => {
  // Increase the amount of connected users and tell all other users about the change
  connectedUsers++;
  io.emit("connected users update", connectedUsers);

  socket.emit("unique id generated", uniqid());

  // Broadcasts messages whenever one is recieved
  socket.on("new message from client", msg => {
    // Strictly enforces the content limit on the server
    if (msg.content.length > 700) {
      msg.content = msg.content.slice(0, 700);
    }

    socket.broadcast.emit("new message", msg);

    // Save messages in local variable
    if (messages.length >= 500) {
      messages.shift();
    }
    messages.push(msg);

    // Save messages to file
    storeMessages();
  });

  // When a user disconnects, tell other users about the new amount of connected users
  socket.on("disconnect", () => {
    connectedUsers--;
    io.emit("connected users update", connectedUsers);
  });
});

/********* SERVER *********/
http.listen(process.env.PORT || 80, () => {
  console.log("listening on port 80");
});

/******** UTILITIES *********/
var timeout;
function storeMessages() {
  /**
   * Debounced message-saving. Will only save to file after 10s of inactivity
   * The file doesn't really need to stay super-updated since new users will get
   * the current messages from memory. File is only there incase server dies
   * and restarts.
   */
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    var stringifiedMessages = JSON.stringify(messages);
    fs.writeFile(__dirname + "/data.json", stringifiedMessages, (err, res) => {
      console.log(
        "Messages saved! File now contains " + messages.length + " messages"
      );
    });
  }, 10000);
}
