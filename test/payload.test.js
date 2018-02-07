const Rapptor = require('rapptor');
const tap = require('tap');
const path = require('path');

process.env.ENDPOINT = '/payload';
const workDir = path.resolve(__dirname, '../');

let rapptor;
const start = async function() {
  rapptor = new Rapptor({
    cwd: workDir
  });

  await rapptor.setup();

  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      return request.payload;
    }
  });

  await rapptor.start();

  return true;
};

const stop = async function() {
  await rapptor.stop();

  return true;
};


tap.test('gathers object confgurations', async (t) => {
  await start();

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'apple-branch-one.localhost' } });

  t.equal(result.statusCode, 503);

  await stop();
  t.end();
});

tap.test('objects are augemented with deep clone', async (t) => {
  await start();
  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'pear-branch-one.localhost' } });
  t.equal(result.statusCode, 503);

  await stop();
  t.end();
});
