const redis = require('redis');
const redisDump = require('redis-dump-restore').dump;
const cliProgress = require('cli-progress');
const config = require('config');

const port = config.get('redis.port');
const db = config.get('redis.db');
const source = config.get('redis.source');
const dest = config.get('redis.destination');

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const sourceClient = redis.createClient(port, source.host,
  {
    auth_pass: source.key,
    tls: {
      servername: source.host,
    },
    detect_buffers: true,
    db,
  });

const destClient = redis.createClient(port, dest.host,
  {
    auth_pass: dest.key,
    tls: {
      servername: dest.host,
    },
    detect_buffers: true,
    db,
  });

const dump = redisDump(sourceClient, '*');

sourceClient.dbsize((err, size) => {
  if (err) {
    console.error(`An error occured in the calback: ${err}`);
    return;
  }

  bar.start(size, 0);

  dump.on('data', (key, data, ttl) => {
    bar.increment();
    destClient.restore(key, ttl, data, (restoreErr) => {
      if (err) {
        throw Error(`An error occured while restoring a key: ${restoreErr}`);
      }
    });
  }).on('error', (dumpErr) => {
    console.error(`An error occured while processing: ${dumpErr}`);
  }).on('end', () => {
    bar.stop();
    sourceClient.quit();
    destClient.quit();
    console.log('Migration Complete!');
  });
});
