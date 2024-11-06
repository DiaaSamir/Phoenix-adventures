const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });

// Create a new PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE, // Your PostgreSQL connection string
});

// Connect to the PostgreSQL database
client
  .connect()
  .then(() => console.log('PostgreSQL DB connection successful!'))
  .catch((err) => {
    console.log('Failed to connect to PostgreSQL:', err);
    process.exit(1);
  });

module.exports = client;
