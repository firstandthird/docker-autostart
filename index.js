const http = require('http');
const wreck = require('wreck');
const Logr = require('logr');
const log = Logr.createLogger({
  type: 'flat',
  reporters: {
    flat: {
      reporter: require('logr-flat')
    }
  }
});

const deployLog = {};

const deployKey = process.env.DEPLOY_KEY;
const deployEndpoint = process.env.ENDPOINT;
const debug = process.env.DEBUG || false;
const jsonFile = process.env.JSON_FILE;


if (!jsonFile) {
  throw new Error('Must provide a json mapping file');
}
const repoMap = require(jsonFile);

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.end('');
    return;
  }
  const hostArr = req.headers.host.split('.');
  const host = hostArr[0];

  let match = false;
  Object.keys(repoMap).forEach((repo) => {
    if (match || !host.startsWith(repo)) {
      return;
    }

    match = true;

    const branch = host.replace(`${repo}-`, '');
    let service = repoMap[repo];
    if (typeof service === 'string') {
      service = {
        endpoint: deployEndpoint, 
        name: service,
        payload: {
          slug: `deploy-stage-${service}`,
          vars: {
            tag: branch,
            branch
          },
          stop: 60
        }
      };
    }
    
    if (!service.endpoint) {
      service.endpoint = deployEndpoint;
    }

    if (!service.name) {
      service.name = repo;
    }

    const deployKey = `${service.name}_${branch}`
    if (deployLog[deployKey]) {
      const now = new Date().getTime() - (5 * 60 * 1000);
      if (now < deployLog[deployKey]) {
        log(['docker-autobuild', 'info'], `${service.name}/${branch} already deploying.`);
        return;
      }
    }

    deployLog[deployKey] = new Date().getTime();

    log(['docker-autobuild', 'info'], `Deploying: ${repo}/${branch}`);
    if (debug) {
      return;
    }
    wreck.post(service.endpoint, {
      payload: service.payload,
    }, (err, res, payload) => {
      if (err) {
        log(['docker-autobuild', 'error'], { err });
      } else {
        log(['docker-autobuild', 'info'], payload.toString());
      }
    });

  });

  if (!match) {
    log(['docker-autobuild', 'info'], `No match for ${host}`);
  }

  res.statusCode = 503
  res.end(`<html><head><title>Building...</title><meta http-equiv="refresh" content="20"></head><body><pre>building. please wait.</pre></body></html>`);
});

server.listen(8080);
