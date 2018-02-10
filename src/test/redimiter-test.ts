import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as Redis from "ioredis";
import * as mocha from "mocha";
import { spy } from "sinon";
import { promisify } from "util";
import redis = require("redis");
import { stringify } from "querystring";
import bodyParser from "body-parser";
import request = require("supertest");
import express = require("express");
import express3 = require("express3"); // old but commonly still used

import Redimiter from "../";
import { setTimeout } from "timers";

// interface Console {
//   error: {
//     restore: Function;
//   };
// }

const { expect } = chai;
const { describe, it, beforeEach, afterEach } = mocha;

// chai.use(chaiAsPromised);

describe("Versions of Redis Client", () => {
  it("should return the same info", async () => {
    const io = new Redis();
    const nR = redis.createClient();
    const nRe = promisify(nR.get).bind(nR);

    const nRed = await nRe("currentSubId");
    const ioRed = await io.get("currentSubId");
    expect(nRed).to.be.equal("388");
    expect(ioRed).to.be.equal("388");
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

[[express, "express4"], [express3, "express3"]].forEach(
  ([expressVersion, name]) => {
    function server() {
      const app = expressVersion();
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
          it("should fire call with 0 args", done => {
            // have to wait a second to let second pass from previous tests
            setTimeout(async () => {
              const spyConsole = spy(console, "error");
              const app = server();
              app.get("/uh", redimiter.rateLimiter(), (req, res) =>
                res.status(200).send("uh")
              );
              const response = await request(app).get("/uh");
              expect(response.status).to.equal(200);
              expect(response.text).to.equal("uh");
              expect(spyConsole.callCount).to.equal(0);
              spyConsole.restore();
              done();
            }, 1001);
          });
          it("should fire call with non string but throw error", async () => {
            const spyConsole = spy(console, "error");
            const app = server();
            app.get("/uh", redimiter.rateLimiter(90), (req, res) =>
              res.status(200).send("uh")
            );
            const response = await request(app).get("/uh");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("uh");
            expect(spyConsole.args[0][0]).to.equal(
              "you need to add a string parameter to your rateLimiter('url') arg."
            );
            spyConsole.restore();
          });
          it("should throw error if strings instead of numbers", async () => {
            const spyConsole = spy(console, "error");
            const app = server();
            app.get(
              "/uh",
              redimiter.rateLimiter(90, "ha", "ararar", false),
              (req, res) => res.status(200).send("uh")
            );
            const response = await request(app).get("/uh");
            expect(response.status).to.equal(500);
            expect(response.text).to.not.equal("uh");
            expect(spyConsole.args[0][0]).to.equal(
              "you need to add a string parameter to your rateLimiter('url') arg."
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
          it("should rate limit then after allotted time allow req again", done => {
            const app = server();

            app.get(
              "/moo",
              redimiter.rateLimiter(`moo${name}${cliName}`, 50, 2, 1),
              (req, res) => res.status(200).send("moo")
            );
            (async function firstTests() {
              const response = await request(app).get("/moo");
              const response2 = await request(app).get("/moo");
              const response3 = await request(app).get("/moo");

              expect(response.status).to.equal(200);
              expect(response.text).to.equal("moo");
              expect(response2.status).to.equal(200);
              expect(response2.text).to.equal("moo");
              expect(response3.status).to.equal(403);
              expect(response3.text).to.not.equal("moo");
            })();

            setTimeout(async () => {
              const response4 = await request(app).get("/moo");
              expect(response4.status).to.equal(200);
              expect(response4.text).to.equal("moo");
              done();
            }, 500);
          });
          it("should rate limit 10 under one second with no args", done => {
            setTimeout(async () => {
              const app = server();
              // this simulates no args
              app.get(`/oo`, redimiter.rateLimiter(), (req, res) =>
                res.status(200).send("oo")
              );

              const response = await request(app).get("/oo");
              const response2 = await request(app).get("/oo");
              const response3 = await request(app).get("/oo");
              const response4 = await request(app).get("/oo");
              const response5 = await request(app).get("/oo");
              const response6 = await request(app).get("/oo");
              const response7 = await request(app).get("/oo");
              const response8 = await request(app).get("/oo");
              const response9 = await request(app).get("/oo");
              const response10 = await request(app).get("/oo");
              const response11 = await request(app).get("/oo");
              const response12 = await request(app).get("/oo");
              const response13 = await request(app).get("/oo");
              const response14 = await request(app).get("/oo");
              const response15 = await request(app).get("/oo");

              expect(response.status).to.equal(200);
              expect(response.text).to.equal("oo");
              expect(response2.status).to.equal(200);
              expect(response2.text).to.equal("oo");
              expect(response3.status).to.equal(200);
              expect(response3.text).to.equal("oo");
              expect(response4.status).to.equal(200);
              expect(response4.text).to.equal("oo");
              expect(response5.status).to.equal(200);
              expect(response5.text).to.equal("oo");
              expect(response6.status).to.equal(200);
              expect(response6.text).to.equal("oo");
              expect(response7.status).to.equal(200);
              expect(response7.text).to.equal("oo");
              expect(response8.status).to.equal(200);
              expect(response8.text).to.equal("oo");
              expect(response9.status).to.equal(200);
              expect(response9.text).to.equal("oo");
              expect(response10.status).to.equal(200);
              expect(response10.text).to.equal("oo");
              expect(response11.status).to.equal(403);
              expect(response11.text).to.not.equal("oo");
              expect(response12.status).to.equal(403);
              expect(response12.text).to.not.equal("oo");
              expect(response13.status).to.equal(403);
              expect(response13.text).to.not.equal("oo");
              expect(response14.status).to.equal(403);
              expect(response14.text).to.not.not.equal("oo");
              expect(response15.status).to.equal(403);
              expect(response15.text).to.not.equal("oo");
              done();
            }, 1201);
          });
        });
      });
    });
  }
);
