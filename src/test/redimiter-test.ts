import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as Redis from "ioredis";
import * as mocha from "mocha";
import { spy } from "sinon";
import redis = require("redis");
import { stringify } from "querystring";
import bodyParser from "body-parser";
import request = require("supertest");
import express = require("express");
import express3 = require("express3"); // old but commonly still used

import Redimiter from "../";
import { setTimeout } from "timers";

interface Console {
  error: {
    restore: Function;
  };
}

const { expect } = chai;
const { describe, it, beforeEach, afterEach } = mocha;

chai.use(chaiAsPromised);

describe("Version of Redis Client", () => {
  it("should be able to determine each version", () => {
    const re = redis.createClient();
    const io = new Redis();
    expect(re.options["socket_nodelay"]).to.not.be.equal(
      io.options["socket_nodelay"]
    );
    expect(re.options["socket_nodelay"]).to.be.a("boolean");
    expect(io.options["socket_nodelay"]).to.be.a("undefined");
  });
  it("should return the same below", done => {
    const io = new Redis();
    const re = redis.createClient();
    function cb(err, res) {
      expect(err).be.equal(null);
      expect(res).to.be.equal("388");
      done();
    }

    io.get("currentSubId", cb);
  });
  it("should return the same info above", done => {
    const re = redis.createClient();
    function cb(err, res) {
      expect(err).be.equal(null);
      expect(res).to.be.equal("388");
      done();
    }
    re.get("currentSubId", cb);
  });
});

interface urlParams {
  [param: string]: any;
}

function urlString(urlParams: urlParams) {
  let string = "/graphql";
  if (urlParams) {
    string += "?" + stringify(urlParams);
  }
  return string;
}

function promiseTo(fn) {
  return new Promise((resolve, reject) => {
    fn((error, result) => (error ? reject(error) : resolve(result)));
  });
}

describe("test harness", () => {
  it("resolves callback promises", async () => {
    const resolveValue = {};
    const result = await promiseTo(cb => cb(null, resolveValue));
    expect(result).to.equal(resolveValue);
  });

  it("rejects callback promises with errors", async () => {
    const rejectError = new Error();
    let caught;
    try {
      await promiseTo(cb => cb(rejectError));
    } catch (error) {
      caught = error;
    }
    expect(caught).to.equal(rejectError);
  });
});

describe("redisRateLimiter constructer", () => {
  it("should throw an error if no redis client", () => {
    const spyConsole = spy(console, "error");
    const r = new Redimiter(null);
    expect(spyConsole.callCount).to.equal(1);
    expect(spyConsole.calledWith("You need to add a redis client")).to.equal(
      true
    );
    expect(spyConsole.args[0][0]).to.equal("You need to add a redis client");
    spyConsole.restore();
  });

  it("should not throw an error with arg", () => {
    const spyConsole = spy(console, "error");
    const r = new Redimiter(new Redis({}));
    const t = new Redimiter(redis.createClient());
    expect(spyConsole.notCalled).to.equal(true);
    expect(spyConsole.args[0]).to.equals(undefined);
    spyConsole.restore();
  });
});

[[express, "express-modern"], [express3, "express-old"]].forEach(
  ([serverImpl, name]) => {
    function server() {
      const app = serverImpl();
      if (app.set) {
        // This ensures consistent tests, as express defaults json spacing to
        // 0 only in "production" mode.
        app.set("json spaces", 0);
      }
      app.on("error", error => {
        console.warn("App encountered an error:", error);
      });
      return app;
    }

    [[Redis, "ioredis"], [redis, "node_redis"]].forEach(([redcli, cliName]) => {
      function redClient() {
        let redimiter;
        if (cliName === "ioredis") {
          redimiter = new Redimiter(new redcli());
        }
        redimiter = new Redimiter(redcli.createClient());
        return redimiter;
      }

      const redimiter = redClient();
      describe(`redisRateLimiter ${cliName} ${name}`, () => {
        describe("redisRateLimiter.rateLimiter() fires as middleware", () => {
          it("should fire call with all args", async () => {
            const app = server();
            app.get(
              "/home",
              redimiter.rateLimiter("/home", 3000, 2000, 1),
              (req, res) => res.status(200).send("happy")
            );
            const response = await request(app).get("/home");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("happy");
          });
          it("should fire call with 1 arg", async () => {
            const app = server();
            app.get("/home", redimiter.rateLimiter("/home"), (req, res) =>
              res.status(200).send("happy")
            );
            const response = await request(app).get("/home");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("happy");
          });
          it("should fire call with 2 args", async () => {
            const app = server();
            app.get("/moon", redimiter.rateLimiter("moon", 3000), (req, res) =>
              res.status(200).send("moon")
            );
            const response = await request(app).get("/moon");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("moon");
          });
          it("should fire call with 3 args", async () => {
            const app = server();
            app.get(
              "/sun",
              redimiter.rateLimiter("sun", 3000, 10),
              (req, res) => res.status(200).send("sun")
            );
            const response = await request(app).get("/sun");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("sun");
          });
          it("should fire call with 0 args but throw error", async () => {
            const spyConsole = spy(console, "error");
            const app = server();
            app.get("/uh", redimiter.rateLimiter(null), (req, res) =>
              res.status(200).send("uh")
            );
            const response = await request(app).get("/uh");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("uh");
            expect(spyConsole.args[0][0]).to.equal(
              "you need to add a string parameter to your rateLimiter('url') arg. It will be 'url' until then"
            );
            spyConsole.restore();
          });
        });
        describe("redisRateLimiter.rateLimiter() ratelimiting", () => {
          it("should allow req if under rate limit", async () => {
            const app = server();
            app.get(
              "/home",
              redimiter.rateLimiter("hello", 3000, 2000, 1),
              (req, res) => res.status(200).send("hello")
            );

            const response = await request(app).get("/home");

            expect(response.status).to.equal(200);
            expect(response.text).to.equal("hello");
          });

          it("should send an error if no ip", async () => {
            const app = server();

            const noIp = (req, res, next) => {
              const ip = undefined;
              if (!ip) {
                res.status(500).send("No ip address");
                return res.end();
              }
              next();
            };
            // this will simulate no ip in test
            app.get("/home", noIp, (req, res) => res.status(200).send("hello"));

            const response = await request(app).get("/home");

            expect(response.status).to.equal(500);
            expect(response.text).to.equal("No ip address");
          });
          it("should rate limit when over limit", async () => {
            const app = server();

            app.get(
              "/howdy",
              redimiter.rateLimiter(`howdy${name}${cliName}`, 3000, 2, 1),
              (req, res) => res.status(200).send("howdy")
            );

            const response = await request(app).get("/howdy");
            const response2 = await request(app).get("/howdy");
            const response3 = await request(app).get("/howdy");

            expect(response.status).to.equal(200);
            expect(response.text).to.equal("howdy");
            expect(response2.status).to.equal(200);
            expect(response2.text).to.equal("howdy");
            expect(response3.status).to.equal(403);
            expect(response3.text).to.not.equal("howdy");
          });
          it("should rate limit then after allotted time allow req again", async () => {
            const app = server();

            app.get(
              "/moo",
              redimiter.rateLimiter(`moo${name}${cliName}`, 50, 2, 1),
              (req, res) => res.status(200).send("moo")
            );
            const n = 2500000;
            const manyComments = num =>
              Array.from({ length: num }, (v, k) => {
                return {
                  body: "oh man",
                  id: k,
                  timeStamp: k,
                  createdBy: "mike"
                };
              });

            const response = await request(app).get("/moo");
            const response2 = await request(app).get("/moo");
            const response3 = await request(app).get("/moo");
            // creating a big array to stall for over 50ms
            const bigArray = manyComments(n);
            const response4 = await request(app).get("/moo");

            expect(response.status).to.equal(200);
            expect(response.text).to.equal("moo");
            expect(response2.status).to.equal(200);
            expect(response2.text).to.equal("moo");
            expect(response3.status).to.equal(403);
            expect(response3.text).to.not.equal("moo");
            expect(response4.status).to.equal(200);
            expect(response4.text).to.equal("moo");
          });
        });
      });
    });
  }
);
