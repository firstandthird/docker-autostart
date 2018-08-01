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
    if (request.query._repo && request.query.firstName !== '') {
      throw Boom.badRequest('whoops');
    }

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
        // reset the hostlog and deploylog
        hostLog[host] = 0;
      }
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

    if (request.query._repo === repo[0]) {
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

    if (hostLog[host] >= redirectCount) {
      return h.response('<html><head><title>Building failed....</title></head><body><pre>building failed. please check logs...</pre></body></html>').code(503);
    }

    hostLog[host]++;

    let respString = `<html><head><title>Ready to build.</title></head><body><div style="margin:auto;width:900px;">Are you ready to build ${repo}? <form style="display:inline-block;" action=""><input type="text" name="firstName"  value="" style="width:0;height:0;display:block;margin:0;padding:0;"/><input type="hidden" name="_repo" value="${repo}"><button type="submit">Build</button></form></div></body></html>`;

    if (request.query._repo === repo) {
      respString = `<html><head><title>Building...</title><meta http-equiv="refresh" content="30"></head><body><pre>building. please wait. ${hostLog[host]}</pre></body></html>`;
    }
    return h.response(respString).code(503);
  }
};
