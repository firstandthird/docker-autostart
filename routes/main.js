const varson = require('varson');
const aug = require('aug');

const deployLog = {};

exports.index = {
  method: 'get',
  path: '/favicon.ico',
  handler(request, h) {
    return '';
  }
};


exports.debug = {
  method: 'get',
  path: '/{path*}',
  handler(request, h) {
    const server = request.server;

    const host = request.headers.host.split('.')[0];
    const defaultService = request.server.settings.app.service;
    const hostData = request.server.settings.app.hosts;

    const deploy = async function(obj) {
      // server.log(['debug'], obj);
      const deployKey = `${obj.name}_${obj.branch}`;
      if (deployLog[deployKey]) {
        const now = new Date().getTime() - (5 * 60 * 1000);
        if (now < deployLog[deployKey]) {
          server.log(['docker-autobuild', 'info'], `${obj.name}/${obj.branch} already deploying.`);
          return false;
        }
      }
      deployLog[deployKey] = new Date().getTime();
      const result = await server.req.post(obj.endpoint, { payload: obj.payload });

      return result;
    };

    let match = false;

    Object.keys(hostData).forEach(repo => {
      if (match || !host.startsWith(repo)) {
        return;
      }

      match = true;
      const branch = host.replace(`${repo}-`, '');
      let service = hostData[repo];
      if (typeof service === 'string') {
        service = [
          {
            name: service
          }
        ];
      }

      if (!Array.isArray(service)) {
        service = [service];
      }

      const proms = service.map(serv => {
        serv.branch = branch;

        const serviceObject = aug({}, defaultService, serv);
        const servicePayload = varson(serviceObject, {}, { start: '{', end: '}' });
        return deploy(servicePayload);
      });

      Promise.all(proms).then((vals) => {
        server.log(['docker-autostart', 'info'], { message: 'deploying services', responses: vals });
      });
    });

    return h.response('<html><head><title>Building...</title><meta http-equiv="refresh" content="20"></head><body><pre>building. please wait.</pre></body></html>').code(503);
  }
};
