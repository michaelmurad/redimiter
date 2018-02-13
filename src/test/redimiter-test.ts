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

const { expect } = chai;
const { describe, it, beforeEach, afterEach } = mocha;

// chai.use(chaiAsPromised);

describe("Versions of Redis Client", () => {
  it("should return the same info", async () => {
    const io = new Redis();
    const testString = "testString123";
    const testString2 = "afdasd";
    const testStringValue = 388;
    const nR = redis.createClient();
    io.set(testString, testStringValue);
    nR.set(testString2, testStringValue + 1);
    const nRe = promisify(nR.get).bind(nR);

    const nRed = await nRe(testString);
    const ioRed = await io.get(testString);
    const nRed2 = await nRe(testString2);
    const ioRed2 = await io.get(testString2);
    expect(nRed).to.be.equal("388");
    expect(ioRed).to.be.equal("388");
    expect(nRed2).to.be.equal("389");
    expect(ioRed2).to.be.equal("389");
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
  it("should console.error an error if no redis client", () => {
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
              redimiter.rateLimiter({
                path: "/home",
                expireMilisecs: 3000,
                rateLimit: 2000,
                increaseByInc: 1
              }),
              (req, res) => res.status(200).send("happy")
            );
            const response = await request(app).get("/home");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("happy");
          });
          it("should fire call with 1 arg", async () => {
            const app = server();
            app.get(
              "/home",
              redimiter.rateLimiter({ path: "/home" }),
              (req, res) => res.status(200).send("happy")
            );
            const response = await request(app).get("/home");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("happy");
          });
          it("should fire call with 2 args", async () => {
            const app = server();
            app.get(
              "/moon",
              redimiter.rateLimiter({ path: "moon", expireMilisecs: 3000 }),
              (req, res) => res.status(200).send("moon")
            );
            const response = await request(app).get("/moon");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("moon");
          });
          it("should fire call with 3 args", async () => {
            const app = server();
            app.get(
              "/sun",
              redimiter.rateLimiter({
                path: "sun",
                expireMilisecs: 3000,
                rateLimit: 10
              }),
              (req, res) => res.status(200).send("sun")
            );
            const response = await request(app).get("/sun");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("sun");
          });
          it("should fire call with 0 args", done => {
            // have to wait a second to let second pass to avoid pollution from previous tests
            setTimeout(async () => {
              const spyConsole = spy(console, "error");
              const app = server();
              const { rateLimiter } = redimiter;
              app.get("/uh", rateLimiter(), (req, res) =>
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
            app.get("/uh", redimiter.rateLimiter({ path: 90 }), (req, res) =>
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
              redimiter.rateLimiter({ path: 90, expireMilisecs: "ha" }),
              (req, res) => res.status(200).send("uh")
            );

            const response = await request(app).get("/uh");

            expect(response.status).to.equal(500);
            expect(response.text).to.not.equal("uh");
            expect(
              redimiter.rateLimiter({ path: 90, expireMilisecs: "ha" })
            ).to.throw("arg must be a number");
            expect(spyConsole.args[0][0]).to.equal(
              "you need to add a string parameter to your rateLimiter('url') arg."
            );
            spyConsole.restore();
          });
        });
        describe("redisRateLimiter.rateLimiter() ratelimiting", () => {
          it("should allow req if under rate limit", async () => {
            const app = server();
            const home = redimiter.rateLimiter({
              path: "hello",
              expireMilisecs: 3000,
              rateLimit: 2000,
              increaseByInc: 1
            });
            app.get("/home", home, (req, res) => res.status(200).send("hello"));

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

            app.post(
              "/howdy",
              redimiter.rateLimiter({
                path: `howdy${name}${cliName}`,
                expireMilisecs: 3000,
                rateLimit: 2
              }),
              (req, res) => res.status(200).send("howdy")
            );

            const response = await request(app).post("/howdy");
            const response2 = await request(app).post("/howdy");
            const response3 = await request(app).post("/howdy");

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
              redimiter.rateLimiter({
                path: `moo${name}${cliName}`,
                expireMilisecs: 50,
                rateLimit: 2
              }),
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
              const { rateLimiter } = redimiter;
              const getLimiter = rateLimiter();
              app.get(`/oo`, getLimiter, (req, res) =>
                res.status(200).send("oo")
              );
              let index = 0;

              while (index < 10) {
                const response = await request(app).get("/oo");
                expect(response.status).to.equal(200);
                expect(response.text).to.equal("oo");
                index += 1;
              }

              const response11 = await request(app).get("/oo");
              expect(response11.status).to.equal(403);
              expect(response11.text).to.not.equal("oo");

              done();
            }, 1001);
          });
          it("should rate limit 5 under one second with rateLimit: 5 args", done => {
            setTimeout(async () => {
              const app = server();
              const { rateLimiter } = redimiter;
              // const getLimiter = rateLimiter();
              app.get(`/oo`, rateLimiter({ rateLimit: 5 }), (req, res) =>
                res.status(200).send("oo")
              );
              let index = 0;

              while (index < 5) {
                const response = await request(app).get("/oo");
                expect(response.status).to.equal(200);
                expect(response.text).to.equal("oo");
                index += 1;
              }

              const response11 = await request(app).get("/oo");
              expect(response11.status).to.equal(403);
              expect(response11.text).to.not.equal("oo");

              done();
            }, 1001);
          });
        });
      });
    });
  }
);
