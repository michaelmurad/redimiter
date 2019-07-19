import * as chai from "chai";
import * as mocha from "mocha";
import { spy } from "sinon";
import request = require("supertest");
import express = require("express");

import Redimiter from "..";
import {
  errorFunc,
  rLPathErr,
  rLExpErr,
  rLLimitErr,
  rLPLimitErr,
  rLPExpErr,
  rLPActionErr,
  rLPUsernameErr
} from "../errors";
import { FakeRedis } from "../testHelpers/fakeRedis";
import { noIp } from "../rateLimiter/noIp";

const { expect } = chai;
const { describe, it, afterEach, beforeEach } = mocha;

describe("errorfunc", () => {
  it("should throw an error", async () => {
    const app = express();
    const err = "test err";
    app.get("/path", (req, res) => {
      return errorFunc(res, err);
    });

    const response = await request(app).get("/path");
    expect(response.text).to.be.equal(err);
    expect(response.status).to.be.equal(500);
  });
});

describe("fake redis", () => {
  const callback = (err, res) => {
    if (err) return err;
    return res;
  };
  it("should have a llen callback error", () => {
    const fakeRedis = new FakeRedis({
      llenErr: "error"
    });
    const result = fakeRedis.llen(123, callback);
    expect(result).to.equal("error");
  });
  it("should have a llen callback response", () => {
    const fakeRedis = new FakeRedis({
      llenRes: "Success"
    });
    const result = fakeRedis.llen(123, callback);
    expect(result).to.equal("Success");
  });
  it("should have a rpushx callback error", () => {
    const fakeRedis = new FakeRedis({
      rpushxErr: "Error"
    });
    const result = fakeRedis.rpushx(123, 1, callback);
    expect(result).to.equal("Error");
  });
  it("should have a rpushx callback response", () => {
    const fakeRedis = new FakeRedis({
      rpushxRes: "Success"
    });
    const result = fakeRedis.rpushx(123, 1, callback);
    expect(result).to.equal("Success");
  });
  it("should have a rpush callback error", () => {
    const fakeRedis = new FakeRedis({
      rpushErr: "Error"
    });
    const result = fakeRedis.rpush(123, 1, callback);
    expect(result).to.equal("Error");
  });
  it("should have a rpush callback response", () => {
    const fakeRedis = new FakeRedis({
      rpushRes: "Success"
    });
    const result = fakeRedis.rpush(123, 1, callback);
    expect(result).to.equal("Success");
  });
  it("should have a exec callback error", () => {
    const fakeRedis = new FakeRedis({
      execErr: "Error"
    });
    const result = fakeRedis
      .multi()
      .rpush(123, 1)
      .rpushx()
      .pexpire()
      .exec(callback);
    expect(result).to.equal("Error");
  });
  it("should have a exec callback response", () => {
    const fakeRedis = new FakeRedis({
      execRes: "Success"
    });
    const result = fakeRedis
      .multi()
      .rpush(123, 1)
      .rpushx()
      .pexpire()
      .exec(callback);
    expect(result).to.equal("Success");
  });
});

describe("noIp", () => {
  it("should return error if no ip", () => {
    const fakeSend = spy();
    const fakeEnd = spy();
    const fakeStatus = spy();
    function Res() {
      this.send = fakeSend;
      this.status = function(x) {
        fakeStatus(x);
        return this;
      };
      this.end = fakeEnd;
    }
    noIp(null, new Res());
    expect(fakeSend.calledOnce).to.be.true;
    expect(fakeSend.args[0][0]).to.equals("No IP address");
    expect(fakeStatus.calledOnce).to.be.true;
    expect(fakeStatus.args[0][0]).to.equals(500);
    expect(fakeEnd.calledOnce).to.be.true;
  });
  it("should do nothing if ip exists", () => {
    const fakeSend = spy();
    function Res() {
      this.send = fakeSend;
      this.status = function() {
        return this;
      };
      this.end = () => null;
    }
    noIp("127.0.0.3", new Res());
    expect(fakeSend.calledOnce).to.be.false;
  });
});

describe("redimiter", () => {
  describe("redisRateLimiter constructer", () => {
    it("should be an instance of Redimiter", () => {
      const r = new Redimiter({});
      expect(r).to.be.an.instanceof(Redimiter);
    });
    it("should console.error an error if no redis client", () => {
      const spyConsole = spy(console, "error");
      const r = new Redimiter(null);
      expect(r).to.be.an.instanceof(Redimiter);
      expect(spyConsole.callCount).to.equal(1);
      expect(spyConsole.calledWith("You need to add a redis client")).to.be
        .true;
      expect(spyConsole.args[0][0]).to.equal("You need to add a redis client");
      spyConsole.restore();
    });

    it("should not throw an error with arg", () => {
      const spyConsole = spy(console, "error");
      const r = new Redimiter({});
      const t = new Redimiter({});
      expect(spyConsole.notCalled).to.be.true;
      expect(spyConsole.args[0]).to.equals(undefined);
      spyConsole.restore();
    });
  });
  describe("redimiter promise", () => {
    describe("redimiter.rateLimiterPromise", () => {
      const { rateLimiterPromise } = new Redimiter(new FakeRedis({}));
      it("should allow options arg", async () => {
        const home = {
          username: "romeo",
          action: "lol",
          expire: 3000,
          limit: 10
        };

        const response = await rateLimiterPromise(home);

        expect(response).to.be.true;
      });
      it("should throw error if no username", async () => {
        const home = {
          action: "lol",
          expire: 3000,
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }

        expect(err).to.equal(rLPUsernameErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if username = ''", async () => {
        const home = {
          username: "",
          action: "lol",
          expire: 3000,
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }

        expect(err).to.equal(rLPUsernameErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if no action", async () => {
        const home = {
          username: "nooooooo",
          expire: 3000,
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }

        expect(err).to.equal(rLPActionErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if action = ''", async () => {
        const home = {
          username: "nooooooo",
          action: "",
          expire: 3000,
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }

        expect(err).to.equal(rLPActionErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if limit is NaN", async () => {
        const home = {
          username: "nooooooo",
          expire: 3000,
          action: "moo",
          limit: "lolz"
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }

        expect(err).to.equal(rLPLimitErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error expire is NaN", async () => {
        const home = {
          username: "nooooooo",
          action: "lol",
          expire: "omg lol",
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }
        expect(err).to.equal(rLPExpErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if expire < 0", async () => {
        const home = {
          username: "ppp",
          action: "lol",
          expire: -1,
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }
        expect(err).to.equal(rLPExpErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if expire = '0'", async () => {
        const home = {
          username: "ppp",
          action: "lol",
          expire: "0",
          limit: 10
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }
        expect(err).to.equal(rLPExpErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if limit < 0", async () => {
        const home = {
          username: "ppp",
          action: "lol",
          expire: 1000,
          limit: -2
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }
        expect(err).to.equal(rLPLimitErr);
        expect(data).to.be.an("undefined");
      });
      it("should throw error if limit = '0'", async () => {
        const home = {
          username: "qpp",
          action: "lol",
          expire: 1000,
          limit: "0"
        };
        let err;
        let data;
        try {
          const response = await rateLimiterPromise(home);
          data = response;
        } catch (error) {
          err = error;
        }
        expect(err).to.equal(rLPLimitErr);
        expect(data).to.be.an("undefined");
      });
    });
    describe("overdrive", () => {
      it("should throw an error if redis.llen returns error", async () => {
        const fakeRedis = new FakeRedis({
          llenErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw an error if redis.exec returns error", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 100,
          execErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw an error if redis.exec returns error w/ no score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0,
          execErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw an error if redis.rpushx err and score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 1,
          rpushxErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw an error if redis.rpushx err and over limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 11,
          rpushxErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw a set error if score === limit * 10", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 10
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equals(
          "You are doing this too much, try again in a little bit"
        );
        expect(data).to.be.an("undefined");
      });
      it("should throw a set error if score > limit * 10", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 1000
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equals(
          "You are doing this WAY too much, try again much later"
        );
        expect(data).to.be.an("undefined");
      });
      it("should throw a set error if score >= limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 12
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equals(
          "You are doing this too much, try again in a little bit"
        );
        expect(data).to.be.an("undefined");
      });
      it("should resolve to true with !score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(data).to.be.equals(true);
        expect(err).to.be.an("undefined");
      });
      it("should resolve to true with score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 3
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test",
            overdrive: true
          });
        } catch (error) {
          err = error;
        }
        expect(data).to.be.equals(true);
        expect(err).to.be.an("undefined");
      });
    });
    describe("non-overdrive", () => {
      it("should throw an error if redis.llen returns error", async () => {
        const fakeRedis = new FakeRedis({
          llenErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw an error if redis.exec returns error w/ no score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0,
          execErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw an error if redis.rpushx err", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 1,
          rpushxErr: "Fake Error"
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(err).to.be.equals("Fake Error");
        expect(data).to.be.an("undefined");
      });
      it("should throw a set error if over limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 11
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equals(
          "You are doing this too much, try again in a little bit"
        );
        expect(data).to.be.an("undefined");
      });
      it("should throw a set error if score = limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 10
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(err.message).to.be.equals(
          "You are doing this too much, try again in a little bit"
        );
        expect(data).to.be.an("undefined");
      });
      it("should resolve to true with !score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(data).to.be.equals(true);
        expect(err).to.be.an("undefined");
      });
      it("should resolve to true with score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 3
        });
        const redimiter = new Redimiter(fakeRedis);
        const { rateLimiterPromise } = redimiter;
        let data;
        let err;
        try {
          data = await rateLimiterPromise({
            username: "moo",
            action: "test"
          });
        } catch (error) {
          err = error;
        }
        expect(data).to.be.equals(true);
        expect(err).to.be.an("undefined");
      });
    });
  });
  describe("middleware", () => {
    describe("redisRateLimiter.rateLimiter() fires as middleware", () => {
      let spyConsole;
      beforeEach(() => (spyConsole = spy(console, "error")));
      afterEach(() => spyConsole.restore());
      const redimiter = new Redimiter(new FakeRedis({}));
      const { rateLimiter }: any = redimiter;
      it("should work with default args", async () => {
        const app = express();
        app.get("/uh", rateLimiter(), (req, res) => res.status(200).send("uh"));
        const response = await request(app).get("/uh");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("uh");
        expect(spyConsole.callCount).to.equal(0);
      });
      it("should work with only path arg", async () => {
        const app = express();
        app.get("/home", rateLimiter({ path: "/home" }), (req, res) =>
          res.status(200).send("happy")
        );
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
      it("should work with only expire arg", async () => {
        const app = express();
        app.get("/home", rateLimiter({ expire: 3000 }), (req, res) =>
          res.status(200).send("happy")
        );
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
      it("should work with only limit arg", async () => {
        const app = express();
        app.get("/home", rateLimiter({ limit: 20 }), (req, res) =>
          res.status(200).send("happy")
        );
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
      it("should work with only path, expire arg", async () => {
        const app = express();
        app.get(
          "/moon",
          rateLimiter({ path: "moon", expire: 3000 }),
          (req, res) => res.status(200).send("moon")
        );
        const response = await request(app).get("/moon");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("moon");
      });
      it("should work with path, expire, limit args", async () => {
        const app = express();
        app.get(
          "/sun",
          rateLimiter({
            path: "sun",
            expire: 3000,
            limit: 10
          }),
          (req, res) => res.status(200).send("sun")
        );
        const response = await request(app).get("/sun");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("sun");
      });
      it("should work with non string but console error", async () => {
        const app = express();
        const option: any = { path: 90 };
        app.get("/uh", rateLimiter(option), (req, res) =>
          res.status(200).send("uh")
        );
        const response = await request(app).get("/uh");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("uh");
        expect(spyConsole.args[0][0]).to.equal(rLPathErr);
      });
      it("should throw error if expire is NaN", async () => {
        const app = express();
        const options: any = { expire: "ha" };
        app.get("/uh", rateLimiter(options), (req, res) =>
          res.status(200).send("uh")
        );

        const response = await request(app).get("/uh");

        expect(response.status).to.equal(500);
        expect(response.text).to.not.equal("uh");
        expect(redimiter.rateLimiter(options)).to.throw(rLExpErr.message);
      });
      it("should throw error if expire is < 0", async () => {
        const app = express();
        const options = { expire: -1 };
        app.get("/uh", rateLimiter(options), (req, res) =>
          res.status(200).send("uh")
        );

        const response = await request(app).get("/uh");

        expect(response.status).to.equal(500);
        expect(response.text).to.not.equal("uh");
        expect(redimiter.rateLimiter(options)).to.throw(rLExpErr.message);
      });
      it("should throw error if limit is NaN", async () => {
        const options: any = { limit: "ha" };
        const app = express();
        app.get("/uh", rateLimiter(options), (req, res) =>
          res.status(200).send("uh")
        );

        const response = await request(app).get("/uh");

        expect(response.status).to.equal(500);
        expect(response.text).to.not.equal("uh");
        expect(redimiter.rateLimiter(options)).to.throw(rLLimitErr.message);
      });
      it("should throw error if limit is < 1", async () => {
        const app = express();
        const options = { limit: -1 };
        app.get("/uh", rateLimiter(options), (req, res) =>
          res.status(200).send("uh")
        );

        const response = await request(app).get("/uh");

        expect(response.status).to.equal(500);
        expect(response.text).to.not.equal("uh");
        expect(redimiter.rateLimiter(options)).to.throw(rLLimitErr.message);
      });
    });
    describe("overdrive", () => {
      const options = { path: "/home", overdrive: true };
      it("should return a 500 error if redis.llen returns error", async () => {
        const app = express();
        const fakeRedis = new FakeRedis({
          llenErr: "Fake Erroraaaaa"
        });
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Erroraaaaa");
      });
      it("should throw a 500 error if redis.exec returns error", async () => {
        const app = express();
        const fakeRedis = new FakeRedis({
          llenRes: 100,
          execErr: "Fake Erroz"
        });
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Erroz");
      });
      it("should throw an error if redis.exec returns error w/ no score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0,
          execErr: "Fake Error"
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Error");
      });
      it("should throw an error if redis.rpushx and score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 1,
          rpushxErr: "Fake Error"
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Error");
      });
      it("should throw an error if redis.rpushx and score => limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 11,
          rpushxErr: "Fake Error"
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Error");
      });
      it("should throw a set error if score = limit * 10", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 100
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(403);
        expect(response.text).to.equal(
          '{"name":"Error","message":"You are doing this WAY too much, try again much later"}'
        );
      });
      it("should throw a set error if score > limit * 10", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 1000
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(403);
        expect(response.text).to.equal(
          '{"name":"Error","message":"You are doing this WAY too much, try again much later"}'
        );
      });
      it("should throw a set error if score = limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 10
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(403);
        expect(response.text).to.equal(
          '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
        );
      });
      it("should throw a set error if score => limit but < limit * 10", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 11
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(403);
        expect(response.text).to.equal(
          '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
        );
      });
      it("should resolve to 200 with !score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
      it("should resolve to 200 with score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 3
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
    });
    describe("non-overdrive", () => {
      const options = { path: "/home" };
      it("should return a 500 error if redis.llen returns error", async () => {
        const app = express();
        const fakeRedis = new FakeRedis({
          llenErr: "Fake Erroraaaaa"
        });
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Erroraaaaa");
      });
      it("should throw a 500 error if redis.exec returns error", async () => {
        const app = express();
        const fakeRedis = new FakeRedis({
          llenRes: 0,
          execErr: "Fake Erroz"
        });
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Erroz");
      });
      it("should throw an error if redis.exec returns error w/ no score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0,
          execErr: "Fake Error"
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Error");
      });
      it("should throw an error if redis.rpushx err and score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 1,
          rpushxErr: "Fake Error"
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(500);
        expect(response.text).to.equal("Fake Error");
      });
      it("should throw a set error if score >= limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 100
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(403);
        expect(response.text).to.equal(
          '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
        );
      });
      it("should throw a set error if score = limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 10
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(403);
        expect(response.text).to.equal(
          '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
        );
      });
      it("should resolve to 200 with !score", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 0
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
      it("should resolve to 200 with score < limit", async () => {
        const fakeRedis = new FakeRedis({
          llenRes: 3
        });
        const app = express();
        const { rateLimiter } = new Redimiter(fakeRedis);
        const limiter: any = rateLimiter(options);
        app.get("/home", limiter, (req, res) => res.status(200).send("happy"));
        const response = await request(app).get("/home");
        expect(response.status).to.equal(200);
        expect(response.text).to.equal("happy");
      });
    });
  });
});
