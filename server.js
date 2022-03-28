require("dotenv").config();
const { Server } = require("socket.io");
const app = require("./app");
const debug = require("debug")("sv:server");
const http = require("http");
const port = normalizePort(process.env.PORT || "3000");
const {
  getPlayersInRoom,
  getActiveRooms,
  randomArray,
  randomnumber,
} = require("./utils/index");
const { placeRole } = require("./data/placeRole");

app.set("port", port);
console.log("Server run on port " + port);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let socketNameMap = new Map();

io.on("connection", (socket) => {
  console.log("a user connected : " + socket.id);

  socket.emit("connection", {
    message: "You connected to socket server",
    socketId: socket.id,
  });

  socket.on("create_room", async (data) => {
    if (data) {
      console.log(socket.id + " create room " + data.roomId);
      // left all room
      let joined_room = Array.from(socket.rooms);
      if (joined_room > 0) {
        joined_room.forEach(async (room) => {
          await socket.leave(room);
        });
      }

      // join
      await socket.join(data.roomId);

      socketNameMap.set(socket.id, data.player.name);
      // init player
      const players = [
        {
          socketId: socket.id,
          name: data.player.name,
          isHost: true,
        },
      ];

      // notify
      socket.emit("created_room", {
        msg: "Create room success",
        roomId: data.roomId,
        players,
      });
    }
  });

  socket.on("join_room", async (data) => {
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
      let activeRooms = await getActiveRooms(io);
      if (!activeRooms.includes(data.roomId)) {
        console.log(`fail to join room ${data.roomId}`);
        socket.emit("failed_join_room", {
          msg: "Join room failed ( No exist room )",
          roomId: data.roomId,
        });
      } else {
        await socket.join(data.roomId);

        // update
        socketNameMap.set(socket.id, data.player.name);
        const players = getPlayersInRoom(io, data.roomId).map((e) => ({
          socketId: e,
          name: socketNameMap.get(e),
          isReady: false,
        }));

        socket.emit("joined_room", {
          msg: "Join room success",
          roomId: data.roomId,
          players,
        });

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
      const players = getPlayersInRoom(io, data.roomId)
        .filter((e) => e != socket.id)
        .map((e) => ({
          name: socketNameMap.get(e),
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

    await socket.leave(data.roomId);
    socket.emit("left_room", {
      msg: "Leave room success",
      roomId: data.roomId,
    });
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

  socket.on("start_game", async (data) => {
    if (data) {
      // notify to everyone
      io.to(data.roomId).emit("started_game", {
        msg: "Game Started",
        playTime: data.playTime,
      });

      // get players in room
      const players = await getPlayersInRoom(io, data.roomId);

      // assign role & place to players
      let rolePlace = await randomArray(placeRole);

      let location = rolePlace.location;
      let roles = rolePlace.roles.slice(0, players.length);

      // random spy
      const spyIndex = randomnumber(0, players.length - 1);
      console.log(spyIndex);

      // assign role to each players
      players.forEach((e, i) => {
        // notify to each player
        io.to(e).emit("randomed_role", {
          msg: "Random Role Already " + e,
          role: i == spyIndex ? { name: "roles.spy" } : roles[i],
          location: i == spyIndex ? "location.spy" : location,
        });
      });
    }
  });

  socket.on("update_play_time", async (data) => {
    if (data) {
      console.log(data);
      socket.to(data.roomId).emit("updated_play_time", {
        msg: "Updated play time",
        playTime: data.playTime,
      });
    }
  });

  socket.on("delete_game", async (data) => {
    if (data) {
      console.log(data);
      socket.to(data.roomId).emit("deleted_game", {
        msg: "Deleted game",
      });
    }
  });

  socket.on("end_game", async (data) => {
    if (data) {
      console.log(data);
      io.to(data.roomId).emit("ended_game", {
        msg: "Game Ended",
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
