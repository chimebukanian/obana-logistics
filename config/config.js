module.exports = {
  development: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT ?? 'mysql',
    migrationStorageTableName: "migrations",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306
  },
  test: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT ?? 'postgres',
    migrationStorageTableName: "migrations",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306
  },
  production: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT ?? 'postgres',
    migrationStorageTableName: "migrations",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306
  },
  use_env_variable: process.env.ENV
}
