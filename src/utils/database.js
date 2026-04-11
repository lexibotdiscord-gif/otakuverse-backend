import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

console.log('🔍 Database Config:');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  DB_USER:', process.env.DB_USER);

const sequelize = new Sequelize(
  process.env.DB_NAME || 'otakuverse',
  process.env.DB_USER || 'otakuverse',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
  }
);

export const connectDB = async () => {
  try {
    console.log('📊 Attempting MySQL connection...');
    await sequelize.authenticate();
    console.log('✅ MySQL connected successfully');
    logger.info('✅ MySQL connected successfully');
    return true;
  } catch (error) {
    console.log('❌ MySQL connection failed:', error.message);
    logger.error('❌ MySQL connection failed:', error.message);
    return false;
  }
};

export default sequelize;
