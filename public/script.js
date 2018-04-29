var app = new Vue({
  el: "#app",
  data: {
    // The socket for getting and posting messages
    socket: undefined,
    // The current users display name
    displayName: "",
    // Uniquely generated id to identify the author
    userId: "",
    // What user has typed in the textarea
    clientMessage: "",
    // Array of current messages
    messages: [],
    // Boolean that determines if the overlay should be visible
    overlayActive: true,
    // Amount of users currently connected to the chat
    usersOnline: 0,
    // Amount of users with unsent changes in their text-field
    // Note: is not used for anything right now
    usersTyping: 0,
    // Weather the app is ready or not
    appReady: false,
    // browser -> "chrome, safari, firefox or other"
    // part of assignment requirements - is also not used for anything
    browser: "",
    // Reference to the body -> just to save the dom lookups
    bodyEl: document.querySelector("body"),
    // Reference to moment.js (it's used in the html-templates and is therefor needed here)
    moment: window.moment,
    // Wether the burgerMenu is open or not
    burgerMenuOpen: false
  },
  methods: {
    verifyDisplayName: function() {
      if (this.displayName && this.displayName.length < 30) {
        this.overlayActive = false;
        localStorage.setItem("displayName", this.displayName);
      }
    },
    emojifyText: function(text) {
      text = text.replace(/:-\)|:\)|:D|:-D/g, "😊");
      text = text.replace(/:-\(|:\(/g, "😢");
      return text;
    },
    sendMessage: function() {
      /**
       * Sends clients message to the server
       */

      // Trims the message so it can't be only spaces and linebreaks
      this.clientMessage = this.clientMessage.trim();

      // Check length (it defined on the textarea but could be manually overwritten)
      if (this.clientMessage.length > 700) {
        this.clientMessage = this.clientMessage.slice(0, 700);
      }

      // If the message if empty, don't send it
      if (this.clientMessage === "") {
        return;
      }

      // Create the message
      var message = {
        time: Date.now(), // Do the time on the server instead...
        author: this.displayName,
        authorId: this.userId,
        content: this.emojifyText(this.clientMessage)
      };

      // Clear current client message
      this.clientMessage = "";

      // Send message to all other users than the client
      this.socket.emit("new message from client", message);

      // Locally add the message to the clients array of messages
      // -> Making it appear instantely available
      this.pushToMessagesArray(message);
    },
    pushToMessagesArray: function(message) {
      this.messages.push(message);
      this.scrollNewMessageIntoView();
    },
    scrollNewMessageIntoView: function() {
      /**
       * Scrolls messages into view whenever a new message is added.
       */
      var context = this; // If the project had a build step i would've used arrow-functions instead

      // Event loop hack. Wait's for dom to be updated before executing
      Vue.nextTick(function() {
        var totalScrollHeight = context.bodyEl.scrollHeight;
        var curScroll = context.bodyEl.scrollTop;
        var screenHeight = window.innerHeight;
        var maxScroll = totalScrollHeight - screenHeight;
        // Arguments list: from value, to value, duration, callback (that applies the animation), easing function
        TinyAnimate.animate(
          curScroll,
          maxScroll,
          120,
          function(newScroll) {
            context.bodyEl.scrollTop = newScroll;
          },
          "ease"
        );
      });
    },
    changeDisplayName: function() {
      // It would be nice too add a close button to the modal. It could just have
      // an inline function toggling the overlayActive to false
      this.overlayActive = true;
    },
    updateConnectedUsers: function(connectedUsers) {
      /**
       * Shows how many users are connected. The curent client is included
       * in the number of connected users, so the number is substracted by one
       */
      this.usersOnline = connectedUsers;
    },
    setExistingMessages(messages) {
      /**
       * Sets the list of messages with the one that the server already has
       */
      this.messages = messages;
      this.appReady = true;
      this.scrollNewMessageIntoView();
      this.runWelcomeSequence();
    },
    determineBrowserType() {
      var userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.indexOf("chrome") !== -1) {
        this.browser = "chrome";
      } else if (userAgent.indexOf("firefox") !== -1) {
        this.browser = "firefox";
      } else if (userAgent.indexOf("safari") !== -1) {
        this.browser = "safari";
      } else {
        this.browser = "other";
      }
    },
    saveUniqueId(uniqueId) {
      localStorage.setItem("userId", uniqueId);
      this.userId = uniqueId;
    },
    runWelcomeSequence() {
      this.messages.unshift({
        time: 1524828448800,
        author: "Chat App Bot",
        content:
          "Hi! Welcome to the chat app\n\nSend messages by typing your message and pressing enter\n\nYou kan make line breaks by holding down the shift key.\n\nThe following shorthands are converted to emojis: \n\n :) \n :-) \n :D \n :( \n :-( \n\nThe chat app is globally available to everyone but stores only the last 500 messages \n\nEnjoy 😊"
      });
    }
  },
  created() {
    /**
     * Lifecycle method ->
     * This function runs as soon as the main vue-app is ready.
     * It connects to the socket and save the connection to the
     * vue-instance. There is a bunch of useful lifecycle methods
     * ie. beforeUpdate or afterUpdate that runs every time the
     * component renders
     */
    this.socket = io(); // connects the socket

    // Get user id
    if (!localStorage.getItem("userId")) {
      this.socket.on("unique id generated", this.saveUniqueId);
    } else {
      this.userId = localStorage.getItem("userId");
    }

    // Listen for new messages
    this.socket.on("new message", this.pushToMessagesArray);

    // Listen for connected users updates:
    this.socket.on("connected users update", this.updateConnectedUsers);

    // try to load display name from local storage -> bypasses modal if it succeeds
    var savedDisplayName = localStorage.getItem("displayName");
    if (savedDisplayName) {
      this.displayName = savedDisplayName;
      this.overlayActive = false;
    }

    // Get existing messages
    // i know that this is a bit old-fashioned, but i saw no reason to include a request
    // library to do one request.
    var request = new XMLHttpRequest();
    request.onload = function(res) {
      this.setExistingMessages(JSON.parse(res.target.response));
    }.bind(this);
    request.open("GET", "/messages");
    request.send();

    // Determine browser type
    this.determineBrowserType();
  },
  watch: {
    /**
     * A watcher triggers a function whenever a value change. You can watch any value
     * within the app.data object.
     * The name of the function (ie. XXXXXXX: function(val) {}) has to match the name of the
     * values being watched
     */
    clientMessage: function(val) {
      if (val && val.length === 1) {
        this.socket.emit("someone is typing");
      } else if (!val) {
        this.socket.emit("someone stopped typing");
      }
    }
  }
});

// Shows the app -> Super simple hack to prevent malformed html when loading
document.getElementById("app").style.display = "block";
var appLoader = document.getElementById("mainAppLoader");
appLoader.parentElement.removeChild(appLoader);
