const { MongoClient } = require('mongodb');

let client;
let db;

const connectionOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 20,
  retryWrites: true,
  w: 'majority',
  ssl: true,
  authSource: 'admin'
};

async function connectToDb() {
  try {
    console.log('Connecting to MongoDB Atlas with URI:', 
      process.env.MONGODB_URI.replace(/:\/\/.*@/, '://<credentials>@'));
    
    client = new MongoClient(process.env.MONGODB_URI, connectionOptions);
    await client.connect();
    db = client.db();
    
    // Verify connection
    await db.command({ ping: 1 });
    console.log('MongoDB Atlas connection successful');
    return db;
  } catch (err) {
    console.error('Initial connection failed:', err.message);
    
    // SRV fallback logic
    if (err.message.includes('querySrv ENOTFOUND')) {
      console.log('Trying direct connection...');
      try {
        const directUri = process.env.MONGODB_URI
          .replace('mongodb+srv://', 'mongodb://')
          .replace('?', '/?directConnection=true&');
        
        client = new MongoClient(directUri, {
          ...connectionOptions,
          directConnection: true
        });
        
        await client.connect();
        db = client.db();
        await db.command({ ping: 1 });
        console.log('Connected using direct connection fallback');
        return db;
      } catch (fallbackErr) {
        console.error('Fallback connection failed:', fallbackErr.message);
      }
    }
    
    throw new Error('All connection attempts failed');
  }
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call connectToDb() first.');
  return db;
}

process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});

module.exports = { connectToDb, getDb };