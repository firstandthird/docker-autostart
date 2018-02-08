const Rapptor = require('rapptor');
const tap = require('tap');
const path = require('path');
const util = require('util');

process.env.ENDPOINT = '/payload';
const workDir = path.resolve(__dirname, '../');

const wait = util.promisify(setTimeout);

const defaultService = {
  endpoint: '/payload',
  payload: {
    slug: 'test-slug-{ name }',
    vars: {
      tag: '{ branch }',
      branch: '{ branch }'
    },
    stop: 60
  }
};

let rapptor;
const start = async function() {
  rapptor = new Rapptor({
    config: {
      service: defaultService
    },
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

  rapptor.server.settings.app.hosts = {
    apple: {
      name: 'apple-app',
      endpoint: '/payload-app'
    }
  };

  let hitPayload = false;
  rapptor.server.route({
    method: 'post',
    path: '/payload-app',
    handler(request, h) {
      t.same(request.payload, {
        slug: 'test-slug-apple-app',
        vars: {
          tag: 'branch-one',
          branch: 'branch-one'
        },
        stop: 60
      });

      hitPayload = true;

      return { success: true };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'apple-branch-one.localhost' } });

  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.ok(hitPayload);
  t.end();
});

tap.test('objects are augemented with deep clone', async (t) => {
  await start();

  rapptor.server.settings.app.hosts = {
    peach: {
      name: 'peach-web',
      payload: {
        extra: 'true'
      },
      endpoint: '/payload-pch'
    }
  };

  let hitPayload = false;

  rapptor.server.route({
    method: 'post',
    path: '/payload-pch',
    handler(request, h) {
      t.same(request.payload, {
        slug: 'test-slug-peach-web',
        vars: {
          tag: 'pie',
          branch: 'pie'
        },
        stop: 60,
        extra: 'true'
      });
      hitPayload = true;
      return { success: 1 };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'peach-pie.localhost' } });
  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.ok(hitPayload);
  t.end();
});

tap.test('multiple objects configured at once all called', async (t) => {
  await start();

  rapptor.server.settings.app.hosts = {
    pear: [
      {
        name: 'pear-api',
        payload: {
          image: 'someimage'
        },
        endpoint: '/payload-one'
      },
      {
        name: 'pear-auth',
        payload: {
          image: 'someother'
        },
        endpoint: '/payload-two'
      }
    ]
  };

  let hitPayloadOne = false;
  rapptor.server.route({
    method: 'post',
    path: '/payload-one',
    handler(request, h) {
      t.same(request.payload, {
        slug: 'test-slug-pear-api',
        vars: {
          tag: 'and-sand',
          branch: 'and-sand'
        },
        image: 'someimage',
        stop: 60
      });
      hitPayloadOne = true;
      return { success: 1 };
    }
  });

  let hitPayloadTwo = false;
  rapptor.server.route({
    method: 'post',
    path: '/payload-two',
    handler(request, h) {
      t.same(request.payload, {
        slug: 'test-slug-pear-auth',
        vars: {
          tag: 'and-sand',
          branch: 'and-sand'
        },
        image: 'someother',
        stop: 60
      });
      hitPayloadTwo = true;
      return { success: 1 };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'pear-and-sand.localhost' } });
  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.ok(hitPayloadOne);
  t.ok(hitPayloadTwo);
  t.end();
});
