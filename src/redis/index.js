const { createClient } = require('redis');

let client = null;

// Kết nối Redis
async function connect() {
  client = createClient({
    socket: { host: '127.0.0.1', port: 6379 },
  });

  client.on('connect', () => console.log('Connected to Redis'));
  client.on('error', (err) => console.error('Redis error:', err));

  try {
    await client.connect();
  } catch (err) {
    console.error('Error connecting to Redis:', err);
  }
}

// Kiểm tra kết nối
async function isConnected() {
  return client && client.isOpen;
}

// Set key (có thể thêm TTL)
async function setData(key, data, ttlInSeconds = null) {
  if (!await isConnected()) return console.log('Redis client is not connected');
  try {
    if (ttlInSeconds) {
      await client.set(key, JSON.stringify(data), { EX: ttlInSeconds });
    } else {
      await client.set(key, JSON.stringify(data));
    }
    console.log(`Data set for key: ${key}`);
  } catch (err) {
    console.error('Error setting data:', err);
  }
}

// Get key
async function getData(key) {
  try {
    const data = await client.get(key);
    if (!data) {
      return null; // Không có dữ liệu
    }
    return JSON.parse(data); // Chuyển chuỗi JSON thành đối tượng/mảng
  } catch (error) {
    console.error("Error getting data:", error);
    return null;
  }
}

// Kiểm tra key tồn tại
async function keyExists(key) {
  if (!await isConnected()) return false;
  try {
    return (await client.exists(key)) === 1;
  } catch (err) {
    console.error('Error checking key existence:', err);
    return false;
  }
}

// Lấy TTL key
async function getKeyTTL(key) {
  if (!await isConnected()) return -1;
  try {
    const ttl = await client.ttl(key);
    if (ttl === -1) console.log(`Key ${key} has no expiration`);
    if (ttl === -2) console.log(`Key ${key} does not exist`);
    return ttl;
  } catch (err) {
    console.error('Error getting TTL:', err);
    return -1;
  }
}

// Xóa key
async function deleteKey(key) {
  if (!await isConnected()) return;
  try {
    await client.del(key);
    console.log(`Key deleted: ${key}`);
  } catch (err) {
    console.error('Error deleting key:', err);
  }
}

async function pushToList(key, values) {
  if (!await isConnected()) return;
  try {
    if (Array.isArray(values)) {
      const pipeline = client.multi(); // Tạo batch commands
      values.forEach(value => pipeline.rPush(key, JSON.stringify(value)));
      await pipeline.exec();
      console.log(`Array added to list: ${key}`);
    } else {
      await client.rPush(key, JSON.stringify(values));
      console.log(`Value added to list: ${key}`);
    }
  } catch (err) {
    console.error('Error pushing to list:', err);
  }
}


async function getList(key) {
  if (!await isConnected()) return [];
  try {
    const list = await client.lRange(key, 0, -1);
    return list.map((item) => JSON.parse(item));
  } catch (err) {
    console.error('Error getting list:', err);
    return [];
  }
}

// Tập hợp (Set)
async function addToSet(key, value) {
  if (!await isConnected()) return;
  try {
    await client.sAdd(key, value);
    console.log(`Value added to set: ${key}`);
  } catch (err) {
    console.error('Error adding to set:', err);
  }
}

async function getSetMembers(key) {
  if (!await isConnected()) return [];
  try {
    return await client.sMembers(key);
  } catch (err) {
    console.error('Error getting set members:', err);
    return [];
  }
}

// Pub/Sub
async function publishMessage(channel, message) {
  if (!await isConnected()) return;
  try {
    await client.publish(channel, JSON.stringify(message));
    console.log(`Message published to channel: ${channel}`);
  } catch (err) {
    console.error('Error publishing message:', err);
  }
}

async function subscribeToChannel(channel) {
  if (!await isConnected()) return;
  const subscriber = client.duplicate();
  await subscriber.connect();

  subscriber.on('message', (chan, message) => {
    console.log(`Received from ${chan}:`, JSON.parse(message));
  });

  try {
    await subscriber.subscribe(channel);
    console.log(`Subscribed to channel: ${channel}`);
  } catch (err) {
    console.error('Error subscribing to channel:', err);
  }
}

// Ngắt kết nối
async function disconnect() {
  if (!await isConnected()) return;
  try {
    await client.quit();
    console.log('Disconnected from Redis');
  } catch (err) {
    console.error('Error disconnecting:', err);
  }
}

module.exports = {
  redisClient: client,
  connect,
  setData,
  getData,
  keyExists,
  getKeyTTL,
  deleteKey,
  pushToList,
  getList,
  addToSet,
  getSetMembers,
  publishMessage,
  subscribeToChannel,
  disconnect,
};
