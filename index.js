const Rapptor = require('rapptor');

const cwd = process.cwd();

const rapptor = new Rapptor({
  configPath: `${__dirname}/conf`,
  cwd
});

const startServer = async function() {
  await rapptor.setup();
  await rapptor.start();
  return rapptor;
};

module.exports = startServer;
