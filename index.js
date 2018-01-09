const http = require('http');
const wreck = require('wreck');

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
    console.log(deployKey);
    if (deployLog[deployKey]) {
      const now = new Date().getTime() - (5 * 60 * 1000);
      if (now < deployLog[deployKey]) {
        console.log(`${service.name}/${branch} already deploying.`);
        return;
      }
    }

    deployLog[deployKey] = new Date().getTime();

    console.log(`Deploying: ${repo}/${branch}`);
    console.log(service);
    if (debug) {
      return
    }
    wreck.post(service.endpoint, {
      payload: service.payload,
    }, (err, res, payload) => {
      if (err) {
        console.error(err);
      } else {
        console.log(payload.toString());
      }
    });

  });

  if (!match) {
    console.log(`No match for ${host}`);
  }

  res.statusCode = 503
  res.end(`<html><head><title>Building...</title><meta http-equiv="refresh" content="20"></head><body><pre>building. please wait.</pre></body></html>`);
});

server.listen(8080);
