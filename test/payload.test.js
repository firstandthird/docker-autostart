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

tap.todo('test deploying twice and having the second one not call endpoints');
tap.todo('test host that doesnt match');
tap.todo('test if endpoint fails');
