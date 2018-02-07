const tap = require('tap');
const startServer = require('../');

process.env.ENDPOINT = '/payload';

tap.test('gathers string configurations correctly', async (t) => {
  const rapptor = await startServer();

  rapptor.server.settings.app.hosts = {
    apple: 'apple'
  };

  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      return request.payload;
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'apple-branch-one.localhost' } });
  t.equals(result.statusCode, 503);
  await rapptor.stop();
  t.end();
});

tap.test('gathers object confgurations', async (t) => {
  const rapptor = await startServer();

  rapptor.server.settings.app.hosts = {
    apple: {
      name: 'apple-web'
    }
  };

  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      return request.payload;
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'apple-branch-one.localhost' } });
  t.equal(result.statusCode, 503);

  await rapptor.stop();
  t.end();
});

tap.test('objects are augemented with deep clone', async (t) => {
  const rapptor = await startServer();

  rapptor.server.settings.app.hosts = {
    pear: {
      name: 'pear-api',
      extra: true,
      vars: {
        more: 'values'
      }
    }
  };

  rapptor.server.route({
    method: 'post',
    path: '/payload',
    handler(request, h) {
      return request.payload;
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'pear-branch-one.localhost' } });
  t.equal(result.statusCode, 503);

  await rapptor.stop();
  t.end();
});
