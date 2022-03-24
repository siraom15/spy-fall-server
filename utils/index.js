const getActiveRooms = async (io) => {
  let rooms = await io.sockets.adapter.rooms;
  if (rooms.size === 0) return [];
  const arr = Array.from(rooms);
  const filtered = arr.filter((room) => !room[1].has(room[0]));
  const res = filtered.map((i) => i[0]);
  return res;
};

const getPlayersInRoom = (io, roomId) => {
  try {
    return Array.from(io.sockets.adapter.rooms.get(roomId));
  } catch (e) {
    console.log(e);
    return [];
  }
};

const randomArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomnumber = (maximum, minimum) =>
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

module.exports = {
  getActiveRooms,
  getPlayersInRoom,
  randomArray,
  randomnumber
};
