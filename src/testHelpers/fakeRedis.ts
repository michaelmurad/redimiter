export function FakeRedis(obj) {
  const {
    execErr,
    execRes,
    llenErr,
    llenRes,
    rpushxErr,
    rpushxRes,
    rpushErr,
    rpushRes
  } = obj;
  this.llen = (rateId, callback) => callback(llenErr, llenRes);
  this.rpushx = (rateId, request, callback) => callback(rpushxErr, rpushxRes);
  this.rpush = (rateId, request, callback) => callback(rpushErr, rpushRes);
  this.multi = function() {
    this.rpush = function() {
      return this;
    };
    this.rpushx = function() {
      return this;
    };
    this.pexpire = function() {
      return this;
    };
    this.exec = function(callback) {
      return callback(execErr, execRes);
    };
    return this;
  };
}
