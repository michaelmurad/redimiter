import * as chai from "chai";
import * as Redis from "ioredis";
import * as mocha from "mocha";
import { spy } from "sinon";
import { promisify } from "util";
import redis = require("redis");
import request = require("supertest");
import express = require("express");
import express3 = require("express3"); // old but commonly still used
const chalk: any = require("chalk");

import Redimiter from "../";
import { setTimeout } from "timers";
import {
  rLPathErr,
  rLLimitErr,
  rLExpErr,
  rLPUsernameErr,
  rLPActionErr,
  rLPLimitErr,
  rLPExpErr
} from "../errors";

console.log(
  chalk.bgGreen(" YOU NEED TO HAVE A REDIS SERVER RUNNING ON LOCAL MACHINE ")
);
const { expect } = chai;
const { describe, it, beforeEach, afterEach } = mocha;

// YOU NEED TO HAVE A REDIS SERVER RUNNING ON LOCAL MACHINE
describe("Redis Client compatability", () => {
  it("should set and return 'OK'", async () => {
    const io = new Redis();
    const testString = "testString123";
    const testString2 = "afdasd";
    const testStringValue = "388";
    const nR = redis.createClient();
    const ioRed = await io.set(testString, testStringValue, "PX", 30000);
    const setAsync = promisify(nR.set).bind(nR);
    const node_redis = await setAsync(
      testString2,
      testStringValue,
      "PX",
      30000
    );
    expect(ioRed).to.equal("OK");
    expect(node_redis).to.equal("OK");
  });
  it("should return the same info", async () => {
    const io = new Redis();
    const testString = "testString123";
    const testString2 = "afdasd";
    const testStringValue = "388";
    const nR = redis.createClient();
    const getAsync = promisify(nR.get).bind(nR);
    const nRed = await getAsync(testString);
    const nRed2 = await getAsync(testString2);
    const ioRed = await io.get(testString);
    const ioRed2 = await io.get(testString2);
    expect(ioRed).to.equal("388");
    expect(nRed).to.equal("388");
    expect(nRed2).to.equal("388");
    expect(ioRed2).to.equal("388");
  });
});

describe("redisRateLimiter constructer", () => {
  it("should be an instance of Redimiter", () => {
    const r = new Redimiter(new Redis());
    expect(r).to.be.an.instanceof(Redimiter);
  });
  it("should console.error an error if no redis client", () => {
    const spyConsole = spy(console, "error");
    const r = new Redimiter(null);
    expect(r).to.be.an.instanceof(Redimiter);
    expect(spyConsole.callCount).to.equal(1);
    expect(spyConsole.calledWith("You need to add a redis client")).to.be.true;
    expect(spyConsole.args[0][0]).to.equal("You need to add a redis client");
    spyConsole.restore();
  });

  it("should not throw an error with arg", () => {
    const spyConsole = spy(console, "error");
    const r = new Redimiter(new Redis({}));
    const t = new Redimiter(redis.createClient());
    expect(spyConsole.notCalled).to.be.true;
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
      const redisClient =
        cliName === "ioredis" ? new redcli() : redcli.createClient();
      const redimiter = new Redimiter(redisClient);
      describe(`redisRateLimiter ${cliName} ${name}`, () => {
        describe("redisRateLimiter.rateLimiter() fires as middleware", () => {
          it("should work with default args", done => {
            // have to wait a second to avoid pollution from previous tests
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
          it("should work with only path arg", async () => {
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
          it("should work with only expire arg", async () => {
            const app = server();
            app.get(
              "/home",
              redimiter.rateLimiter({ expire: 3000 }),
              (req, res) => res.status(200).send("happy")
            );
            const response = await request(app).get("/home");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("happy");
          });
          it("should work with only limit arg", async () => {
            const app = server();
            app.get("/home", redimiter.rateLimiter({ limit: 20 }), (req, res) =>
              res.status(200).send("happy")
            );
            const response = await request(app).get("/home");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("happy");
          });
          it("should work with only path, expire arg", async () => {
            const app = server();
            app.get(
              "/moon",
              redimiter.rateLimiter({ path: "moon", expire: 3000 }),
              (req, res) => res.status(200).send("moon")
            );
            const response = await request(app).get("/moon");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("moon");
          });
          it("should work with path, expire, limit args", async () => {
            const app = server();
            app.get(
              "/sun",
              redimiter.rateLimiter({
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
            const spyConsole = spy(console, "error");
            const app = server();
            const option: any = { path: 90 };
            app.get("/uh", redimiter.rateLimiter(option), (req, res) =>
              res.status(200).send("uh")
            );
            const response = await request(app).get("/uh");
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("uh");
            expect(spyConsole.args[0][0]).to.equal(rLPathErr);
            spyConsole.restore();
          });
          it("should throw error if expire is NaN", async () => {
            const app = server();
            const options: any = { expire: "ha" };
            app.get("/uh", redimiter.rateLimiter(options), (req, res) =>
              res.status(200).send("uh")
            );

            const response = await request(app).get("/uh");

            expect(response.status).to.equal(500);
            expect(response.text).to.not.equal("uh");
            expect(redimiter.rateLimiter(options)).to.throw(rLExpErr.message);
          });
          it("should throw error if expire is < 0", async () => {
            const app = server();
            const options = { expire: -1 };
            app.get("/uh", redimiter.rateLimiter(options), (req, res) =>
              res.status(200).send("uh")
            );

            const response = await request(app).get("/uh");

            expect(response.status).to.equal(500);
            expect(response.text).to.not.equal("uh");
            expect(redimiter.rateLimiter(options)).to.throw(rLExpErr.message);
          });
          it("should throw error if limit is NaN", async () => {
            const options: any = { limit: "ha" };
            const app = server();
            app.get("/uh", redimiter.rateLimiter(options), (req, res) =>
              res.status(200).send("uh")
            );

            const response = await request(app).get("/uh");

            expect(response.status).to.equal(500);
            expect(response.text).to.not.equal("uh");
            expect(redimiter.rateLimiter(options)).to.throw(rLLimitErr.message);
          });
          it("should throw error if limit is < 1", async () => {
            const app = server();
            const options = { limit: -1 };
            app.get("/uh", redimiter.rateLimiter(options), (req, res) =>
              res.status(200).send("uh")
            );

            const response = await request(app).get("/uh");

            expect(response.status).to.equal(500);
            expect(response.text).to.not.equal("uh");
            expect(redimiter.rateLimiter(options)).to.throw(rLLimitErr.message);
          });
        });
        describe("redisRateLimiter.rateLimiter() nonOverdrive ratelimiting", () => {
          it("should allow req if under rate limit", async () => {
            const app = server();
            const home = redimiter.rateLimiter({
              path: "hello",
              expire: 3000,
              limit: 2000
            });
            app.get("/home", home, (req, res) => res.status(200).send("hello"));

            const response = await request(app).get("/home");

            expect(response.status).to.equal(200);
            expect(response.text).to.equal("hello");
          });

          it("should send an error if no ip", async () => {
            const app = server();

            // this will simulate no ip
            const noIp = (req, res, next) => {
              const ip = undefined;
              if (!ip) {
                res.status(500).send("No ip address");
                return res.end();
              }
              next();
            };

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
                expire: 3000,
                limit: 2
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
            expect(response3.text).to.equal(
              '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
            );
          });
          it("should rate limit then after allotted time allow req again", done => {
            const app = server();

            app.get(
              "/moo",
              redimiter.rateLimiter({
                path: `moo${name}${cliName}`,
                expire: 50,
                limit: 2
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
              expect(response3.text).to.equal(
                '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
              );
            })();

            setTimeout(async () => {
              const response4 = await request(app).get("/moo");
              expect(response4.status).to.equal(200);
              expect(response4.text).to.equal("moo");
              done();
            }, 500);
          });
          it("should set limit to default with limit = 0", async () => {
            const app = server();
            const { rateLimiter } = redimiter;
            const getLimiter = rateLimiter({ path: "limit=0", limit: 0 });
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
          });
          it("should default expire with expire = 0", async () => {
            const app = server();
            const { rateLimiter } = redimiter;
            const getLimiter = rateLimiter({ path: "awawaw", expire: 0 });
            app.get(`/oo`, getLimiter, (req, res) =>
              res.status(200).send("oo")
            );
            const response = await request(app).get("/oo");
            const rediss = new Redis();
            const time = await rediss.pttl("::ffff:127.0.0.1:awawaw");
            expect(time).to.be.above(1);
            expect(time).to.be.below(1000);
            expect(response.status).to.equal(200);
            expect(response.text).to.equal("oo");
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
          it("should rate limit 5 under one second with limit: 5 args", done => {
            setTimeout(async () => {
              const app = server();
              const { rateLimiter } = redimiter;
              // const getLimiter = rateLimiter();
              app.get(`/oo`, rateLimiter({ limit: 5 }), (req, res) =>
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
        describe("redisRateLimiter.rateLimiter() overdrive ratelimiting", () => {
          describe("should work if overdrive is added", () => {
            it("should allow req if under rate limit", async () => {
              const app = server();
              const home = redimiter.rateLimiter({
                path: "romeo",
                expire: 3000,
                limit: 10,
                overdrive: true
              });
              app.get("/romeo", home, (req, res) =>
                res.status(200).send("hellooo")
              );

              const response = await request(app).get("/romeo");

              expect(response.status).to.equal(200);
              expect(response.text).to.equal("hellooo");
            });
            it("should rate limit", async () => {
              const app = server();
              const home = redimiter.rateLimiter({
                path: "juliet",
                expire: 20,
                limit: 1,
                overdrive: true
              });
              app.get("/juliet", home, (req, res) =>
                res.status(200).send("hellooo")
              );

              const response = await request(app).get("/juliet");
              const response2 = await request(app).get("/juliet");

              expect(response.status).to.equal(200);
              expect(response.text).to.equal("hellooo");

              expect(response2.status).to.equal(403);
              expect(response2.text).to.equal(
                '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
              );
            });
            it("should rate limit into overdrive", async () => {
              const app = server();
              const now = Math.round(Date.now()).toString();
              const home = redimiter.rateLimiter({
                path: `juju${cliName}${name}${now}`,
                expire: 1000,
                limit: 1,
                overdrive: true
              });
              app.get("/juju", home, (req, res) =>
                res.status(200).send("hellooo")
              );
              let index = 0;
              const response = await request(app).get("/juju");
              expect(response.status).to.equal(200);
              expect(response.text).to.equal("hellooo");
              while (index < 9) {
                const response = await request(app).get("/juju");
                expect(response.status).to.equal(403);
                expect(response.text).to.equal(
                  '{"name":"Error","message":"You are doing this too much, try again in a little bit"}'
                );
                index += 1;
              }
              const responseLast = await request(app).get("/juju");
              const redis = new Redis();
              const pttl = await redis.pttl(
                `::ffff:127.0.0.1:juju${cliName}${name}${now}`
              );
              expect(pttl).to.be.above(800000);
              expect(pttl).to.be.below(1000001);
              expect(responseLast.status).to.equal(403);
              expect(responseLast.text).to.equal(
                '{"name":"Error","message":"You are doing this WAY too much, try again much later"}'
              );
            });
            it("should only allow 10 requests", async () => {
              const sent = spy();
              const app = server();
              const now = Math.round(Date.now()).toString();
              const home = redimiter.rateLimiter({
                path: `sea${cliName}${name}${now}`,
                expire: 40000,
                limit: 10,
                overdrive: false
              });
              app.get("/sea", home, (req, res) => {
                sent();
                res.status(200).send("lol");
              });
              let index = 0;
              while (index < 150) {
                const response = await request(app).get("/sea");
                index += 1;
              }
              // const response = await request(app).get("/sea");
              // expect(response.status).to.equal(200);
              // expect(response.text).to.equal("lol");
              expect(sent.callCount).to.equal(10);
            });
            it("should not allow 150 requests", async () => {
              const sent = spy();
              const app = server();
              const now = Math.round(Date.now()).toString();
              const home = redimiter.rateLimiter({
                path: `tree${cliName}${name}${now}`,
                expire: 40,
                limit: 10,
                overdrive: false
              });
              app.get("/tree", home, (req, res) => {
                sent();
                res.status(200).send("lol");
              });
              let index = 0;
              while (index < 150) {
                const response = await request(app).get("/tree");
                index += 1;
              }
              // const response = await request(app).get("/sea");
              // expect(response.status).to.equal(200);
              // expect(response.text).to.equal("lol");
              expect(sent.callCount).to.below(150);
            });
          });
        });
      });
    });
  }
);
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
  const { rateLimiterPromise } = redimiter;
  describe(`rateLimiterPromise ${cliName}`, () => {
    describe("nonoverdrive", () => {
      it("should allow options arg", async () => {
        const home = {
          username: "romeo" + cliName,
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
      it("should allow 10 requests if limit is default", async () => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}mooo`
        };

        let err;
        let data;
        let data10;

        try {
          const response = await rateLimiterPromise(options);
          data = response;
          let index = 1;
          while (index < 9) {
            const response2 = await rateLimiterPromise(options);
            index += 1;
          }
          const response10 = await rateLimiterPromise(options);
          data10 = response10;
        } catch (error) {
          err = error;
        }

        expect(err).to.be.an("undefined");
        expect(data).to.be.true;
        expect(data10).to.be.true;
      });
      it("should allow 10 requests if limit is 0", async () => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}ooo`,
          limit: 0
        };

        let err;
        let data;
        let data10;

        try {
          const response = await rateLimiterPromise(options);
          data = response;
          let index = 1;
          while (index < 9) {
            const response2 = await rateLimiterPromise(options);
            index += 1;
          }
          const response10 = await rateLimiterPromise(options);
          data10 = response10;
        } catch (error) {
          err = error;
        }

        expect(err).to.be.an("undefined");
        expect(data).to.be.true;
        expect(data10).to.be.true;
      });
      it("should default to 1000 if expire is 0", async () => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}ooo`,
          expire: 0
        };
        const redis = new Redis();
        let err;
        let data;
        let exp;

        try {
          const response = await rateLimiterPromise(options);
          const pttl = await redis.pttl(`${username}:${cliName}ooo`);
          data = response;
          exp = pttl;
        } catch (error) {
          err = error;
        }

        expect(err).to.be.an("undefined");
        expect(data).to.be.true;
        expect(exp).to.be.above(0);
        expect(exp).to.be.below(1001);
      });
      it("should allow x requests if limit is x", async () => {
        const username = Math.round(Date.now()).toString();
        const limit = Math.round(Math.random() * 10) + 1;
        const options = {
          username,
          action: `${cliName}mooso`,
          limit
        };

        let err;
        let err2;
        let data5;

        try {
          let index = 0;
          while (index < limit) {
            const response2 = await rateLimiterPromise(options);
            expect(response2).to.be.true;
            index += 1;
          }
        } catch (error) {
          err = error;
        }
        try {
          const response5 = await rateLimiterPromise(options);
          data5 = response5;
        } catch (error) {
          err2 = error;
        }

        expect(err).to.be.an("undefined");
        expect(data5).to.be.an("undefined");
        expect(err2.message).to.equal(
          "You are doing this too much, try again in a little bit"
        );
      });
      it("should throw error if over limit", async () => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}mooop`
        };

        let err;
        let data;
        let data10;

        try {
          const response = await rateLimiterPromise(options);
          data = response;
          let index = 1;
          while (index < 10) {
            const response2 = await rateLimiterPromise(options);
            index += 1;
          }
          const response10 = await rateLimiterPromise(options);
          data10 = response10;
        } catch (error) {
          err = error;
        }

        expect(err.message).to.equals(
          "You are doing this too much, try again in a little bit"
        );
        expect(data).to.be.true;
        expect(data10).to.be.an("undefined");
      });
      it("should allow requests again after expire", done => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}mo`,
          expire: 20,
          limit: 1
        };

        (async function firstTests() {
          let err;
          let data;
          let err2;
          let data2;
          try {
            const response = await rateLimiterPromise(options);
            data = response;
          } catch (error) {
            err = error;
          }

          try {
            const response2 = await rateLimiterPromise(options);
            data2 = response2;
          } catch (error) {
            err2 = error;
          }
          expect(err).to.be.an("undefined");
          expect(data).to.be.true;
          expect(data2).to.be.an("undefined");
          expect(err2.message).to.equal(
            "You are doing this too much, try again in a little bit"
          );
        })();

        setTimeout(async () => {
          let err3;
          let data3;
          try {
            const response3 = await rateLimiterPromise(options);
            data3 = response3;
          } catch (error) {
            err3 = error;
          }
          expect(data3).to.be.true;
          expect(err3).to.be.an("undefined");
          done();
        }, 100);
      });
    });
    describe("overdrive", () => {
      it("should allow options arg", async () => {
        const home = {
          username: "romeoa" + cliName,
          action: "lol",
          expire: 3000,
          limit: 10,
          overdrive: true
        };

        const response = await rateLimiterPromise(home);

        expect(response).to.be.true;
      });
      it("should throw error if no username", async () => {
        const home = {
          action: "lol",
          expire: 3000,
          limit: 10,
          overdrive: true
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
          username: "noooooooa",
          expire: 3000,
          limit: 10,
          overdrive: true
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
      it("should allow 10 requests if limit is default", async () => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}moooa`,
          overdrive: true
        };

        let err;
        let data;
        let data10;

        try {
          const response = await rateLimiterPromise(options);
          data = response;
          let index = 1;
          while (index < 9) {
            const response2 = await rateLimiterPromise(options);
            index += 1;
          }
          const response10 = await rateLimiterPromise(options);
          data10 = response10;
        } catch (error) {
          err = error;
        }

        expect(err).to.be.an("undefined");
        expect(data).to.be.true;
        expect(data10).to.be.true;
      });
      it("should allow x requests if limit is x", async () => {
        const username = Math.round(Date.now()).toString();
        const limit = Math.round(Math.random() * 10) + 1;
        const options = {
          username,
          action: `${cliName}moosoa`,
          limit,
          overdrive: true
        };

        let err;
        let err2;
        let data5;

        try {
          let index = 0;
          while (index < limit) {
            const response2 = await rateLimiterPromise(options);
            expect(response2).to.be.true;
            index += 1;
          }
        } catch (error) {
          err = error;
        }
        try {
          const response5 = await rateLimiterPromise(options);
          data5 = response5;
        } catch (error) {
          err2 = error;
        }

        expect(err).to.be.an("undefined");
        expect(data5).to.be.an("undefined");
        expect(err2.message).to.equal(
          "You are doing this too much, try again in a little bit"
        );
      });
      it("should throw error if over limit", async () => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}mooopa`,
          overdrive: true
        };

        let err;
        let data;
        let data10;

        try {
          const response = await rateLimiterPromise(options);
          data = response;
          let index = 1;
          while (index < 10) {
            const response2 = await rateLimiterPromise(options);
            index += 1;
          }
          const response10 = await rateLimiterPromise(options);
          data10 = response10;
        } catch (error) {
          err = error;
        }

        expect(err.message).to.equals(
          "You are doing this too much, try again in a little bit"
        );
        expect(data).to.be.true;
        expect(data10).to.be.an("undefined");
      });
      it("should allow requests again after expire", done => {
        const username = Math.round(Date.now()).toString();
        const options = {
          username,
          action: `${cliName}moa`,
          expire: 20,
          limit: 1,
          overdrive: true
        };

        (async function firstTests() {
          let err;
          let data;
          let err2;
          let data2;
          try {
            const response = await rateLimiterPromise(options);
            data = response;
          } catch (error) {
            err = error;
          }

          try {
            const response2 = await rateLimiterPromise(options);
            data2 = response2;
          } catch (error) {
            err2 = error;
          }
          expect(err).to.be.an("undefined");
          expect(data).to.be.true;
          expect(data2).to.be.an("undefined");
          expect(err2.message).to.equal(
            "You are doing this too much, try again in a little bit"
          );
        })();

        setTimeout(async () => {
          let err3;
          let data3;
          try {
            const response3 = await rateLimiterPromise(options);
            data3 = response3;
          } catch (error) {
            err3 = error;
          }
          expect(data3).to.be.true;
          expect(err3).to.be.an("undefined");
          done();
        }, 100);
      });
      it("should go into overdrive", async () => {
        const username = Math.round(Date.now()).toString();
        const fired = spy();
        const limit = 1;
        const expire = 100;
        const options = {
          username,
          action: `${cliName}moosoa`,
          overdrive: true,
          limit,
          expire
        };
        const redis = new Redis();
        let err;
        let index = 0;

        while (index < limit * 10) {
          try {
            while (index < limit * 10) {
              const response = await rateLimiterPromise(options);
            }
          } catch (error) {
            err = error;
          }
          index += 1;
          fired();
        }
        const pttl = await redis.pttl(`${username}:${cliName}moosoa`);
        expect(pttl).to.be.above(90000);
        expect(pttl).to.be.below(100001);
        expect(fired.callCount).to.equal(10);
        expect(err.message).to.equal(
          "You are doing this WAY too much, try again much later"
        );
      });
    });
  });
});
