const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.DB_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.DB_PORT,
});

const updateTeamSharePointUrl = async (teamId, sharepointFolderUrl) => {
  const result = await pool.query(
    'UPDATE teams SET sharepoint_folder_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [sharepointFolderUrl, teamId]
  );
  return result.rows[0];
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  updateTeamSharePointUrl,
};
