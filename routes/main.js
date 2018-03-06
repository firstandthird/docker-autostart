const varson = require('varson');
const clone = require('lodash.clonedeep');
const aug = require('aug');
const Boom = require('boom');

const deployLog = {};
const hostLog = {};

exports.deploy = {
  method: '*',
  path: '/{path*}',
  async handler(request, h) {
    const server = request.server;
    const host = request.headers.host.split('.')[0];
    const defaultService = request.server.settings.app.defaults || {};
    const hostData = request.server.settings.app.hosts;
    const redirectCount = (request.server.settings.app.redirectCount / 1);

    if (request.server.settings.app.userAgentSkip) {
      const ua = request.headers['user-agent'];
      let skip = false;
      request.server.settings.app.userAgentSkip.forEach(skipAgent => {
        if (ua.includes(skipAgent)) {
          skip = true;
        }
      });

      if (skip) {
        return 'User agent skip';
      }
    }

    server.log(['docker-autostart', 'notice'], { host: request.headers.host, userAgent: request.headers['user-agent'] });

    const deploy = async function(obj) {
      if (!obj.endpoint) {
        throw new Error('Service configurations must provide an endpoint.');
      }
      obj.payload = obj.payload || {};
      const payloadUniq = request.server.methods.payloadId(obj.payload);
      const deployKey = `${host}_${obj.endpoint}_${payloadUniq}`;

      if (deployLog[deployKey]) {
        const now = new Date().getTime() - (5 * 60 * 1000);
        if (now < deployLog[deployKey]) {
          return { endpoint: obj.endpoint, display: `Already deploying ${host}` };
        }
      }
      // reset the hostlog and deploylog
      hostLog[host] = 0;
      deployLog[deployKey] = new Date().getTime();
      try {
        const result = await server.req.post(obj.endpoint, { payload: obj.payload });
        return { success: result, display: 'success', endpoint: obj.endpoint, payload: obj.payload };
      } catch (e) {
        let error = e;
        if (e.isBoom) {
          error = e.output;
        }
        server.log(['docker-autostart', 'endpoint', 'error'], { error, endpoint: obj.endpoint, payload: obj.payload });
        // reset deployLog
        deployLog[deployKey] = 0;
        return { error, endpoint: obj.endpoint, payload: obj.payload };
      }
    };

    let repo = Object.keys(hostData).filter(key => host.startsWith(key));

    if (!repo.length) {
      throw Boom.notFound('repo not found');
    }

    let vals;

    if (repo.length) {
      repo = repo[0];

      const branch = host.replace(`${repo}-`, '');
      let service = hostData[repo];

      if (!Array.isArray(service)) {
        service = [service];
      }

      const proms = service.map(serv => {
        serv.branch = branch;

        const serviceObject = aug({}, clone(defaultService), clone(serv));
        const servicePayload = varson(serviceObject, {}, { start: '{', end: '}' });
        return deploy(servicePayload);
      });

      vals = await Promise.all(proms);
      server.log(['docker-autostart', 'info'], { message: 'deploying services', responses: vals });
    }

    if (!hostLog[host]) {
      hostLog[host] = 0;
    }

    let metaTag = '';

    if (hostLog[host] < redirectCount) {
      hostLog[host]++;
      metaTag = '<meta http-equiv="refresh" content="30">';
    }

    return h.response(`<html><head><title>Building...</title>${metaTag}</head><body><pre>building. please wait.</pre></body></html>`).code(503);
  }
};
