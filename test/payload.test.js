const Rapptor = require('rapptor');
const tap = require('tap');
const path = require('path');
const util = require('util');

process.env.ENDPOINT = '/payload';
const workDir = path.resolve(__dirname, '../');

const wait = util.promisify(setTimeout);

let rapptor;
const start = async function() {
  rapptor = new Rapptor({
    cwd: workDir
  });

  await rapptor.setup();
  await rapptor.start();

  return true;
};

const stop = async function() {
  await rapptor.stop();

  return true;
};


tap.test('gathers object confgurations', async (t) => {
  await start();

  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      t.same(request.payload, { slug: 'test-slug-apple-app', vars: { tag: 'branch-one', branch: 'branch-one' }, stop: 60 });
      return { success: true };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'apple-branch-one.localhost' } });

  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();

  t.end();
});

tap.test('objects are augemented with deep clone', async (t) => {
  await start();

  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      t.same(request.payload, { slug: 'test-slug-peach-web', vars: { tag: 'branch-one', branch: 'branch-one' }, stop: 60, extra: 'true' });
      return { success: 1 };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'peach-branch-one.localhost' } });
  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.end();
});

tap.test('multiple objects configured at once all called', async (t) => {
  await start();

  let callCount = 0;
  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      callCount++;
      t.ok(['test-slug-pear-auth', 'test-slug-pear-api'].includes(request.payload.slug));
      t.ok(request.payload.image);
      t.ok(['someother', 'someimage'].includes(request.payload.image));
      t.equals(request.payload.stop, 60);
      return { success: 1 };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'pear-branch-one.localhost' } });
  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.equal(callCount, 2);
  t.end();
});
