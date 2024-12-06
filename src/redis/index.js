const { createClient } = require('redis');

let client = null;

// Connect to Redis
async function connect() {
  client = createClient({
    socket: {
      host: '127.0.0.1',
      port: 6379,
    },
  });

  client.on('connect', () => {
    console.log('Connected to Redis');
  });

  client.on('error', (err) => {
    console.error('Redis error:', err);
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('Error connecting to Redis:', err);
  }
}

// Check if Redis client is connected
async function isConnected() {
  return client && client.isOpen;
}

// Set data in Redis
async function setData(key, data) {
  if (!await isConnected()) {
    console.log('Redis client is not connected');
    return;
  }

  try {
    await client.set(key, JSON.stringify(data));
    console.log(`Data set for key: ${key}`);
  } catch (err) {
    console.error('Error setting data:', err);
  }
}

// Get data from Redis
async function getData(key) {
  if (!await isConnected()) {
    console.log('Redis client is not connected');
    return null;
  }

  try {
    const data = await client.get(key);
    if (data) {
      return JSON.parse(data);
    } else {
      console.log(`No data found for key: ${key}`);
      return null;
    }
  } catch (err) {
    console.error('Error getting data:', err);
    return null;
  }
}

// Update data in Redis
async function updateData(key, newData) {
  if (!await isConnected()) {
    console.log('Redis client is not connected');
    return;
  }

  try {
    const currentData = await getData(key);
    if (currentData) {
      const updatedData = { ...currentData, ...newData };
      await setData(key, updatedData);
      console.log(`Data updated for key: ${key}`);
    } else {
      console.log(`No data found for key: ${key}, unable to update.`);
    }
  } catch (err) {
    console.error('Error updating data:', err);
  }
}

// Delete data from Redis
async function deleteKey(key) {
  if (!await isConnected()) {
    console.log('Redis client is not connected');
    return;
  }

  try {
    await client.del(key);
    console.log(`Data deleted for key: ${key}`);
  } catch (err) {
    console.error('Error deleting data:', err);
  }
}

// Disconnect from Redis
async function disconnect() {
  if (!await isConnected()) {
    console.log('Redis client is not connected');
    return;
  }

  try {
    await client.quit();
    console.log('Disconnected from Redis');
  } catch (err) {
    console.error('Error disconnecting from Redis:', err);
  }
}

module.exports = {
  connect,
  setData,
  getData,
  updateData,
  deleteKey,
  disconnect,
};
