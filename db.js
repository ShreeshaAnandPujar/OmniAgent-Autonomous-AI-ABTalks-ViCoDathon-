import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('db.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { config: null, posts: [], rejected: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { config: null, posts: [], rejected: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
}

export const db = {
  init() {
    readDb();
  },

  getConfig() {
    return readDb().config;
  },

  saveConfig(config) {
    const data = readDb();
    data.config = config;
    writeDb(data);
  },

  getPosts() {
    return readDb().posts || [];
  },

  addPost(post) {
    const data = readDb();
    if (!data.posts) data.posts = [];
    data.posts.unshift(post); // Insert at the beginning (newest first)
    writeDb(data);
  },

  getRejected() {
    return readDb().rejected || [];
  },

  addRejected(topic) {
    const data = readDb();
    if (!data.rejected) data.rejected = [];
    data.rejected.push(topic);
    writeDb(data);
  }
};
