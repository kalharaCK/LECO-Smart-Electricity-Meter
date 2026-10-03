require('dotenv').config();
const app = require('./app');
const { connectDb } = require('./config/db');

const port = process.env.PORT || 3000;

const startServer = async () => {
  await connectDb();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

startServer();
