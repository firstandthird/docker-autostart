const crypto = require('crypto');

module.exports = {
  method(payload) {
    const payloadString = JSON.stringify(payload);
    const hash = crypto.createHash('md5').update(payloadString).digest('hex');
    return hash.substring(0, 8);
  }
};

