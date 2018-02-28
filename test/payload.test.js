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
  await rapptor.start();
};

const stop = async function() {
  await rapptor.stop();
};

tap.test('multiple objects configured at once all called', async (t) => {
  await start();

  rapptor.server.settings.app.hosts = {
    pear: [
      {
        payload: {
          image: 'someimage:{branch}',
          name: 'pear-api',
          labels: {
            AUTOSTOP: 100
          }
        },
        endpoint: '/payload-one'
      },
      {
        payload: {
          name: 'pear-auth',
          image: 'someother:{branch}'
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
        image: 'someimage:and-sand',
        name: 'pear-api',
        labels: {
          AUTOSTOP: 100
        }
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
        image: 'someother:and-sand',
        name: 'pear-auth'
      });
      hitPayloadTwo = true;
      return { success: 1 };
    }
  });

  const result = await rapptor.server.inject({
    url: '/',
    method: 'get',
    headers: {
      host: 'pear-and-sand.localhost'
    }
  });
  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.ok(hitPayloadOne);
  t.ok(hitPayloadTwo);
  t.end();
});

tap.test('test with single endpoint object instead of array', async (t) => {
  await start();

  rapptor.server.settings.app.hosts = {
    apple: {
      payload: {
        recipe: 'apple-pie',
        ingredients: [
          'crust',
          '{ branch }'
        ],
        image: 'image:{ branch }'
      },
      endpoint: '/payload-app'
    }
  };

  let hitPayload = false;
  rapptor.server.route({
    method: 'post',
    path: '/payload-app',
    handler(request, h) {
      hitPayload = true;

      t.same(request.payload, {
        recipe: 'apple-pie',
        ingredients: ['crust', 'branch-one'],
        image: 'image:branch-one'
      });

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

tap.test('test deploying twice and having the second one not call endpoints', async (t) => {
  await start();

  let correctLog = false;
  rapptor.server.log = (tags, m) => {
    if (m === 'carrot-bread already deploying') {
      correctLog = true;
    }
  };

  rapptor.server.settings.app.hosts = {
    carrot: {
      payload: {
        recipe: '{ branch }-pie',
      },
      endpoint: '/payload-c'
    }
  };

  let hitPayload = 0;
  rapptor.server.route({
    method: 'post',
    path: '/payload-c',
    handler(request, h) {
      hitPayload++;
      return { success: true };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'carrot-bread.localhost' } });

  t.equal(result.statusCode, 503);

  await wait(500);

  const secondResult = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'carrot-bread.localhost' } });

  t.equal(secondResult.statusCode, 503);

  await(500);
  await stop();
  t.ok(correctLog);
  t.equal(hitPayload, 1);
  t.end();
});

tap.test('test host that doesnt match', async (t) => {
  await start();

  rapptor.server.settings.app.hosts = {
    nothingburger: {
      payload: {
        recipe: '{ branch }-pie',
      },
      endpoint: '/payload-nota'
    }
  };

  rapptor.server.route({
    method: 'post',
    path: '/payload-nota',
    handler(request, h) {
      throw new Error('Should not hit this endpoint');
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'carrot-bread.localhost' } });

  t.equal(result.statusCode, 404);

  await wait(700);

  await stop();
  t.end();
});

tap.test('test if endpoint fails', async (t) => {
  await start();

  let correctLog = false;
  rapptor.server.log = (tags, m) => {
    if (tags.includes('error') && m.error && m.error.statusCode === 500) {
      correctLog = true;
    }
  };

  rapptor.server.settings.app.hosts = {
    uhoh: {
      payload: {
        recipe: 'tree-{ branch }',
      },
      endpoint: 'http://localhost:8080/payload-nonexist'
    }
  };

  rapptor.server.route({
    method: 'post',
    path: '/payload-nonexist',
    handler(request, h) {
      return h.response({ error: true }).code(500);
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'uhoh-nueva.localhost' } });

  t.ok(result.payload.includes('http://localhost:8080/payload-nonexist => 500'));
  t.equal(result.statusCode, 503);

  await wait(700);

  await stop();
  t.ok(correctLog);
  t.end();
});

tap.test('test user agent skip', async (t) => {
  await start();

  rapptor.server.settings.app.hosts = {
    skippy: {
      payload: {
        recipe: 'tree-{ branch }',
      },
      endpoint: '/payload-to-skip'
    }
  };

  rapptor.server.settings.app.userAgentSkip = ['Bad User'];

  let payloadSkipped = true;
  rapptor.server.route({
    method: 'post',
    path: '/payload-to-skip',
    handler(request, h) {
      payloadSkipped = false;
      return { success: 1 };
    }
  });

  const result = await rapptor.server.inject({ url: '/', method: 'get', headers: { host: 'uhoh-nueva.localhost', 'user-agent': 'Bad User Agent' } });

  t.equal(result.statusCode, 200);
  t.equal(result.payload, 'User agent skip');

  await wait(700);

  await stop();
  t.ok(payloadSkipped);
  t.end();
});
