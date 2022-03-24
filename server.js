require("dotenv").config();
const { Server } = require("socket.io");
const app = require("./app");
const debug = require("debug")("sv:server");
const http = require("http");
const port = normalizePort(process.env.PORT || "4000");
const { getPlayersInRoom, getActiveRooms } = require("./utils/index");

app.set("port", port);
console.log("Server run on port " + port);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("a user connected : " + socket.id);

  socket.emit("connection", {
    message: "You connected to socket server",
    socketId: socket.id,
  });

  socket.on("create_room", async (data) => {
    console.log(socket.id + " create room " + data.roomId);
    if (data) {
      // left all room
      let joined_room = Array.from(socket.rooms);
      if (joined_room > 0) {
        joined_room.forEach(async (room) => {
          await socket.leave(room);
        });
      }

      // join
      await socket.join(data.roomId);

      // init player
      const players = await getPlayersInRoom(io, data.roomId).map((e) => ({
        socketId: e,
        isReady: false,
      }));

      // notify
      socket.emit("created_room", {
        msg: "Create room success",
        roomId: data.roomId,
        players,
      });
    }
  });

  socket.on("join_room", async (data) => {
    console.log(socket.id + " join room " + data.roomId);
    // join
    if (data) {
      // left all room
      let joined_room = Array.from(socket.rooms);
      if (joined_room > 0) {
        joined_room.forEach(async (room) => {
          await socket.leave(room);
        });
      }

      // check is room exist
      let activeRoom = await getActiveRooms(io);
      if (!Array.from(io.sockets.adapter.rooms).includes(data.roomId)) {
        console.log(`fail to join room ${data.roomId}`);
        socket.emit("failed_join_room", {
          msg: "Join room failed ( No exist room )",
          roomId: data.roomId,
        });
      } else {
        await socket.join(data.roomId);
        socket.emit("joined_room", {
          msg: "Join room success",
          roomId: data.roomId,
        });

        // init player
        const players = getPlayersInRoom(io, data.roomId).map((e) => ({
          socketId: e,
          isReady: false,
        }));

        // send update to all
        socket.to(data.roomId).emit("update_player_room", {
          msg: "Updated player room (Someone Joined)",
          roomId: data.roomId,
          players,
        });
      }
    }
  });
  socket.on("leave_room", async (data) => {
    // leave
    if (data) {
      await socket.leave(data.roomId);
      socket.emit("left_room", {
        msg: "Leave room success",
        roomId: data.roomId,
      });

      // init player
      const players = getPlayersInRoom(io, data.roomId).map((e) => ({
        socketId: e,
        isReady: false,
      }));

      // send update to all
      socket.to(data.roomId).emit("update_player_room", {
        msg: "Updated player room (Someone Leave)",
        roomId: data.roomId,
        players,
      });
    }
  });
  socket.on("update_player_ready", (data) => {
    console.log(socket.id + " update player ready " + data.roomId);
    if (data) {
      // init player
      const players = getPlayersInRoom(io, data.roomId).map((e) => ({
        socketId: e,
        isReady: false,
      }));

      // send update to all
      socket.to(data.roomId).emit("update_player_room", {
        msg: "Updated player room (Someone Ready)",
        roomId: data.roomId,
        players: getPlayersInRoom(io, data.roomId),
      });
    }
  });
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
}
function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}
function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}
