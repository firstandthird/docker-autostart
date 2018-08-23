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

    const doBuild = request.headers['x-build'] === '1';
    const monitoring = request.query.monitor === '1';
    server.log(['docker-autostart', 'notice'], { host: request.headers.host, userAgent: request.headers['user-agent'] });

    const deploy = async function(obj) {
      if (!obj.endpoint) {
        throw new Error('Service configurations must provide an endpoint.');
      }
      obj.payload = obj.payload || {};

      try {
        const result = await server.req.post(obj.endpoint, { payload: obj.payload });
        return { success: result, display: 'success', endpoint: obj.endpoint, payload: obj.payload };
      } catch (e) {
        let error = e;
        if (e.isBoom) {
          error = e.output;
        }
        server.log(['docker-autostart', 'endpoint', 'error'], { error, endpoint: obj.endpoint, payload: obj.payload });
        return { error, endpoint: obj.endpoint, payload: obj.payload };
      }
    };

    let repo = Object.keys(hostData).filter(key => host.startsWith(key));

    if (!repo.length) {
      throw Boom.notFound('repo not found');
    }

    let vals;

    if (doBuild) {
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

    if (!deployLog[host]) {
      deployLog[host] = new Date().getTime();
    }
    const now = new Date().getTime() - (5 * 60 * 1000);
    if (now > deployLog[host]) {
      deployLog[host] = new Date().getTime();
      hostLog[host] = 0;
    }
    if (hostLog[host] >= redirectCount) {
      return h.response('<html><head><title>Building failed....</title></head><body><pre>building failed. please check logs...</pre></body></html>').code(503);
    }

    hostLog[host]++;

    if (doBuild) {
      return { success: 1 };
    }

    if (monitoring) {
      return `<html><head><title>Building...</title><meta http-equiv="refresh" content="30"></head><body><div style="width:900px;margin:auto;">Building. please wait. ${hostLog[host]}</div></body></html>`;
    }

    const respString = `
      <html>
        <head>
          <title>Ready to build.</title>
        </head>
        <body>
          <div id="container" style="margin:auto;width:900px;">
            Are you ready to build ${repo}? <button id="build">Build</button>
          </div>
          <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
          <script type="text/javascript">
            $.when( $.ready ).then(function() {
              $("button#build").click(function(e) {
                var self = e.currentTarget;
                $.ajax({
                  method: 'GET',
                  url: '',
                  headers: {
                    'x-build': '1'
                  }
                }).done(function() {
                  $(self).hide();
                  $("#container").append(' <strong>deploying...</strong>');
                  setTimeout(function() {
                    window.location = '?monitor=1'
                  }, 5000);
                });
                return false;
              });
            });
          </script>
        </body>
      </html>`;

    return h.response(respString).code(503);
  }
};
