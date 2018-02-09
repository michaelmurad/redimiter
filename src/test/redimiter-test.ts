import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as Redis from "ioredis";
import * as mocha from "mocha";
import { spy } from "sinon";
import { stringify } from "querystring";
import bodyParser from "body-parser";
import request = require("supertest");
import express = require("express");
import restify from "restify";

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

function server() {
  const app = express();
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

const redimiter = new Redimiter(new Redis({}));
// const spyConsole = spy(console, "error");
// const spyRateLimiter = spy(rrl, "rateLimiter");
spy();
describe(`redisRateLimiter`, () => {
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
      expect(spyConsole.notCalled).to.equal(true);
      expect(spyConsole.args[0]).to.equals(undefined);
      spyConsole.restore();
    });
  });
  describe("redisRateLimiter.rateLimiter() fires as middleware", () => {
    it("should fire call with all args", async () => {
      const spyRateLimiter = spy(redimiter, "rateLimiter");
      const app = server();
      app.get("/home", redimiter.rateLimiter("/home", 3000, 2, 1), (req, res) =>
        res.status(200).send("happy")
      );
      expect(spyRateLimiter.callCount).to.equal(1);
      expect(spyRateLimiter.args[0][0]).to.equals("/home");
      expect(spyRateLimiter.args[0][1]).to.equals(3000);
      expect(spyRateLimiter.args[0][2]).to.equals(2);
      expect(spyRateLimiter.args[0][3]).to.equals(1);
      const response = await request(app).get("/home");
      expect(response.status).to.equal(200);
      expect(response.text).to.equal("happy");
      spyRateLimiter.restore();
    });
    it("should fire call with 1 arg", async () => {
      const spyRateLimiter = spy(redimiter, "rateLimiter");
      const app = server();
      app.get("/home", redimiter.rateLimiter("/home"), (req, res) =>
        res.status(200).send("happy")
      );
      expect(spyRateLimiter.callCount).to.equal(1);
      expect(spyRateLimiter.args[0][0]).to.equals("/home");
      const response = await request(app).get("/home");
      expect(response.status).to.equal(200);
      expect(response.text).to.equal("happy");
      spyRateLimiter.restore();
    });
    it("should fire call with 2 args", async () => {
      const spyRateLimiter = spy(redimiter, "rateLimiter");
      const app = server();
      app.get("/moon", redimiter.rateLimiter("moon", 3000), (req, res) =>
        res.status(200).send("moon")
      );
      expect(spyRateLimiter.callCount).to.equal(1);
      expect(spyRateLimiter.args[0][0]).to.equals("moon");
      expect(spyRateLimiter.args[0][1]).to.equals(3000);
      const response = await request(app).get("/moon");
      expect(response.status).to.equal(200);
      expect(response.text).to.equal("moon");
      spyRateLimiter.restore();
    });
    it("should fire call with 3 args", async () => {
      const spyRateLimiter = spy(redimiter, "rateLimiter");
      const app = server();
      app.get("/sun", redimiter.rateLimiter("sun", 3000, 10), (req, res) =>
        res.status(200).send("sun")
      );
      expect(spyRateLimiter.callCount).to.equal(1);
      expect(spyRateLimiter.args[0][0]).to.equal("sun");
      expect(spyRateLimiter.args[0][1]).to.equal(3000);
      expect(spyRateLimiter.args[0][2]).to.equal(10);
      const response = await request(app).get("/sun");
      expect(response.status).to.equal(200);
      expect(response.text).to.equal("sun");
      spyRateLimiter.restore();
    });
    it("should fire call with 0 args but throw error", async () => {
      const spyConsole = spy(console, "error");
      const spyRateLimiter = spy(redimiter, "rateLimiter");
      const app = server();
      app.get("/uh", redimiter.rateLimiter(null), (req, res) =>
        res.status(200).send("uh")
      );
      expect(spyRateLimiter.callCount).to.equal(1);
      expect(spyRateLimiter.args[0][0]).to.equal(null);
      const response = await request(app).get("/uh");
      expect(response.status).to.equal(200);
      expect(response.text).to.equal("uh");
      expect(spyConsole.args[0][0]).to.equal(
        "you need to add a string parameter to your rateLimiter('url') arg. It will be 'url' until then"
      );
      spyConsole.restore();
      spyRateLimiter.restore();
    });
  });
  describe("redisRateLimiter.rateLimiter() ratelimiting", () => {
    it("should allow req if under rate limit", async () => {
      const app = server();
      app.get("/home", redimiter.rateLimiter("hello", 3000, 2, 1), (req, res) =>
        res.status(200).send("hello")
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
        redimiter.rateLimiter("howdy", 3000, 2, 1),
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

      app.get("/moo", redimiter.rateLimiter("moo", 50, 2, 1), (req, res) =>
        res.status(200).send("moo")
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
