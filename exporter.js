const redis = require('redis');
const dump = require('redis-dump-restore').dump;
const cliProgress = require('cli-progress');
const config = require('config');

const port = config.get('redis.port');
const db = config.get('redis.db');
const source = config.get('redis.source');
const dest = config.get('redis.destination');

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const source_client = redis.createClient(port, source.host,
    { auth_pass: source.key, tls: { servername: source.host }, detect_buffers: true, db: db});

const dest_client = redis.createClient(port, dest.host,
    { auth_pass: dest.key, tls: { servername: dest.host }, detect_buffers: true, db: db});

const d = dump(source_client, '*');

source_client.dbsize( function(err, size) {
    if (err) {
        console.error(`An error occured in the calback: ${err}`)
        return;
    }

    bar.start(size, 0);

    d.on('data', function (key, data, ttl) {
        bar.increment()
        dest_client.restore(key, ttl, data, function(err) {
            if (err) {
                throw Error(`An error occured while restoring a key: ${err}`);
            }
        });
    }).on('error', function (err) {
        console.error(`An error occured while processing: ${err}`)
    }).on('end', function () {
        bar.stop();
        source_client.quit();
        dest_client.quit();
        console.log('Migration Complete!')
    });
});


