import { RedisOptions, Redis as RedisClient } from "ioredis";
import { NextFunction, Request, Response } from "express";
import nonOverdrive from "./rateLimiter/nonOverdrive";
import overDrive from "./rateLimiter/overdrive";
import nonOverdrivePromise from "./rateLimiterPromise/nonOverdrive";
import overdrivePromise from "./rateLimiterPromise/overdrive";
import {
  rLPathErr,
  rLExpErr,
  rLLimitErr,
  rLPActionErr,
  rLPUsernameErr,
  rLPExpErr,
  rLPLimitErr,
  constrErr
} from "./errors";

export interface RateLimiterOptions {
  /** Redis key that will be appended to the ip that will store client request rate.*/
  path?: string;
  /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
  expire?: number;
  /** the limit of requests allowed within the expire timeframe. DEFAULT 10 */
  limit?: number;
  /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
  overdrive?: boolean;
}
export interface RateLimiterPromiseOptions {
  /** Redis key that will be appended to the ip that will store client request rate.*/
  username: string;
  /** Redis key that will be appended to the ip that will store client request rate.*/
  action: string;
  /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
  expire?: number;
  /** the limit of requests allowed within the expire timeframe. DEFAULT 10 */
  limit?: number;
  /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
  overdrive?: boolean;
}

/**
 * @typedef {object} Redimiter A class that has a constructor that takes a redis client and then has rate limiting methods
 * @property {function} constructor Creates a new instance of RedisRateLimiter
 * @property {function} rateLimiter An express middleware rate limiter that uses a client's ip address
 * @property {function} rateLimiterPromise A rate limiter that returns a promise
 */
export default class Redimiter {
  public redisClient: RedisClient;
  /**
   * @param redisClient a Redis client
   */
  constructor(redisClient: RedisClient) {
    if (redisClient) {
      this.redisClient = redisClient;
    } else {
      console.error("You need to add a redis client");
    }
  }
  /**
   * @param {RateLimiterOptions} options An options object
   */
  public rateLimiter = (
    options: RateLimiterOptions = {
      path: "",
      expire: 1000,
      limit: 10,
      overdrive: false
    }
  ): Function => (req: Request, res, next: NextFunction): Function => {
    const path = options.path || "";
    const preParseExp: number | any = options.expire;
    const preParseLim: number | any = options.limit;
    // this is to ensure that any float or string
    // is turned into an Int and if it can't be then
    // eventually will throw an error
    const expire = preParseExp ? parseInt(preParseExp, 10) : 1000;
    const limit = preParseLim ? parseInt(preParseLim, 10) : 10;
    const overdrive = options.overdrive;
    if (path && typeof path !== "string") {
      console.error(rLPathErr);
    }
    if (isNaN(expire) || expire < 1) {
      console.error(rLExpErr);
      throw rLExpErr;
    }
    if (isNaN(limit) || limit < 1) {
      console.error(rLLimitErr);
      throw rLLimitErr;
    }
    const redis: RedisClient = this.redisClient;
    const ip = req.ip;
    if (!ip) {
      res.status(500).send("No ip address");
      return res.end();
    }
    const rateId: string = path ? `${ip}:${path}` : ip;
    if (!overdrive) {
      return nonOverdrive(rateId, redis, limit, expire, res, next);
    }
    return overDrive(rateId, redis, limit, expire, res, next);
  };
  public rateLimiterPromise: Function = (
    options: RateLimiterPromiseOptions
  ): Promise<null | boolean> =>
    new Promise((resolve, reject) => {
      const redis: RedisClient = this.redisClient;
      const username = options.username;
      const action = options.action;
      const preParseExp: number | any = options.expire;
      const preParseLim: number | any = options.limit;
      // this is to ensure that any float or string
      // is turned into an Int and if it can't be then
      // eventually will throw an error
      const expire = preParseExp ? parseInt(preParseExp, 10) : 1000;
      const limit = preParseLim ? parseInt(preParseLim, 10) : 10;
      if (!username) {
        return reject(rLPUsernameErr);
      }
      if (!action) {
        return reject(rLPActionErr);
      }
      if (isNaN(expire) || expire < 1) {
        return reject(rLPExpErr);
      }
      if (isNaN(limit) || limit < 1) {
        return reject(rLPLimitErr);
      }
      const rateId: string = `${username}:${action}`;
      if (!options.overdrive) {
        return nonOverdrivePromise(
          rateId,
          redis,
          limit,
          expire,
          reject,
          resolve
        );
      }
      return overdrivePromise(rateId, redis, limit, expire, reject, resolve);
    });
}
