/**
 * Runs knex seed:run only if the utenti table is empty.
 * Used in deployment startCommand to seed the DB on first deploy
 * without wiping data on subsequent restarts.
 */
const knex = require('knex');
const config = require('../knexfile');

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env]);

async function main() {
  try {
    const [{ count }] = await db('utenti').count('* as count');
    if (Number(count) === 0) {
      console.log('[seed-if-empty] DB vuoto, eseguo seed...');
      await db.seed.run();
      console.log('[seed-if-empty] Seed completato.');
    } else {
      console.log(`[seed-if-empty] DB già popolato (${count} utenti), skip seed.`);
    }
  } catch (err) {
    console.error('[seed-if-empty] Errore:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
