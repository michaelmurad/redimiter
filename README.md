![assembly2.png](https://s18.postimg.org/b9jh50ieh/assembly2.png)

A simple, customizable, Redis based [Express](https://expressjs.com/) middleware and [Node](https://nodejs.org) rate limiter.

# Quick Start

via [npm](https://github.com/npm/npm)

## Install

```shell
$ npm install redimiter
```

## Basic Usage

```javascript
import Redimiter from "redimiter";
```

## Connect to Redis

Create a simple `Redimiter` instance and pass a redis client as an argument.

I recommend the terrific [ioredis](https://github.com/luin/ioredis) Redis client. You can also use [node_redis](https://github.com/NodeRedis/node_redis).

```javascript
const redis = new Redis();

const redimiter = new Redimeter(redis);
```

If you pass no arguments to the Redis constructor, as shown above, it will automatically connect to a local Redis server which is great for developement.

## Using as express middleware

Simply add it as middleware with no args and it will rate limit 10 requests/second using the client's ip address:

```javascript
app = express();

const limit = redimiter.rateLimiter();

app.get("/pages", limit, getPages);
```

You can easily add customizable rate limiting on each path using the rateLimiter method options argument,

```javascript
app = express();

/*  if you are unfamiliar with es6 destructuring
*   the following line is the equivalent of
*   const rateLimiter = redimiter.rateLimiter
*/
const { rateLimiter } = redimiter;

const pagesOptions = {
  path: "GET/pages",
  expire: 30000,
  limit: 20
};

const catsOptions = { path: "/cats" };

app.get("/pages", rateLimiter(pagesOptions), getPages);

app.post("/cats", rateLimiter(catsOptions), postCats);
```

group similar requests easily,

```javascript
app = express();

const { rateLimiter } = redimiter;

const getLimit = rateLimiter({ path: "/GET" });

const postLimit = rateLimiter({ path: "/POST", expire: 3000 });

app.get("/pages", getLimit, getPages);
app.get("/books", getLimit, getBooks);
app.get("/chapters", getLimit, getChapters);

app.post("/cats", postLimit, postCats);
app.post("/dogs", postLimit, postDogs);
app.post("/bats", postLimit, postBats);
```

or use a general one size fits all:

```javascript
app = express();

const { rateLimiter } = redimiter;

const limit = rateLimiter();

app.get("/pages", limit, getPages);

app.post("/cats", limit, postCats);
```

## Using as Promise

You can also return a promise:

```javascript
const { rateLimiterPromise } = redimiter;

rateLimiterPromise(username, 'createComment', 60000, 1)
.then(() => doSomething()}
// rejects with error if client is over rate limit
.catch(err => rateLimterErr(err))
```

<br>

# API

## Redimiter(redisClient)

<hr>

Redimiter is a contructor that takes a redis client as an argument.

### example

```javascript
import Redimiter from "redimiter";
import * as Redis from "ioredis";

redis = new Redis();

redimiter = new Redimiter(redis);
```

It is tested to work with both ioredis and node_redis clients.

<br>

## .rateLimiter({options})

<hr>

.rateLimiter is an Express middleware.

It stores the ip of the client + optional path (`ip:path`) as a Redis list and for each client request it adds an item. This sum of items can be called the rate score and is compared to the rate limit to determine if the api request should be allowed. Once over the rate limit the score is no longer increased and requests are blocked, unless overdrive is set to true (see below).

The list has an expiration added and when it expires the score starts from scratch after the next client request from the same ip.

| Option    | Default | Description                                                                                                                                                                                                                                                                                                                   |
| :-------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| path      | null    | A string that will be appended to the client's ip, used as the key in Redis.                                                                                                                                                                                                                                                  |
| expire    | 1,000   | The miliseconds before Redis key expires.                                                                                                                                                                                                                                                                                     |
| limit     | 10      | The number at which client requests will be limited.                                                                                                                                                                                                                                                                          |
| overdrive | false   | If `true` keeps count of requests after limit has been surpased. At limit x 10 it will set expire to x1000 and then discontinue counting requests and will simpy block them until expiration. Otherwise if `false` once the limit is surpassed requests will not be counted and will simply be blocked until the key expires. |

#### examples

With no option object arg, `rateLimiter()` defaults to 10 requests per second.

```javascript
app.get("/pages", rateLimiter(), getPages);
```

When no path is specified, Redimiter uses the clients ip as the redis key. This means that all requests will be counted indesciminate of request type.

To change the limit to 2 per second, simply add:

```javascript
app.post("/faces", limit({ limit: 2 }), postPages);
```

With the `path` option defined, the redis key will be `ip:path` and will now be able to set seperate limits on different requests and also not have all requests count towards the same rate score.

```javascript
app.get("/pages", rateLimiter({ path: "get/pages" }), getPages);
```

With these `path` and `expire` values, it defaults to a max of 10 requests in the specified 3 seconds. The 3 seconds will begin at the client's first request and each subsequent request that happens after the redis key has expired.

```javascript
app.get("/pages", rateLimiter({ path: "getPages", expire: 3000 }), getPages);
```

With these `path`, `expire`, and `limit` values, it allows a max of 20 requests per 4 seconds.

```javascript
app.get(
  "/pages",
  rateLimiter({ path: "getPages", expire: 4000, limit: 20 }),
  getPages
);
```

The following rate limiter has `overdrive` set to true! It will continue to increase the rate score value per request until it gets to 10x the `limit`, at which it will kick into 'overdrive' and limit the client for 1000x the `expire`, thus blocking the oboxious user/bot for quite some time... in this case it would be 3000ms x 1000, or 50 minutes. While in 'overdrive' it will discontinue keeping score and simply block requests until the time expires.

```javascript
app.get(
  "/pages",
  rateLimiter({
    path: "getPages",
    expire: 3000,
    limit: 200,
    overdrive: true
  }),
  getPages
);
```

<br>

## .rateLimiterPromise({options})

<hr>

This method returns a promise and can be used in a Nodejs application anywhere you may need rate limiting, but express middleware is not available or appropriate.

```javascript
redimiter.rateLimiterPromise(username,action?,  expire?, limit?, overdrive?)
.then(() => doSomething())
.catch((err) => rateLimitErr(err))
```

| Params    | Default | Description                                                                                                                                                                                                                                                                                                                   |
| :-------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| username  | null    | (REQUIRED) A string that will be used as the key in Redis for the client request.                                                                                                                                                                                                                                             |
| action    | null    | (REQUIRED) A string that will be appended to username.                                                                                                                                                                                                                                                                        |
| expire    | 1,000   | The miliseconds before redis key expires.                                                                                                                                                                                                                                                                                     |
| limit     | 10      | The limit at which client requests will be limited                                                                                                                                                                                                                                                                            |
| overdrive | false   | If `true` keeps count of requests after limit has been surpased. At limit x 10 it will set expire to x1000 and then discontinue counting requests and will simpy block them until expiration. Otherwise if `false` once the limit is surpassed requests will not be counted and will simply be blocked until the key expires. |

### examples

This works much like .rateLimiter() only here you need to specify the `username` and `action`. If the client is over the limit, the promise will reject with an error and the .then action will not be called.

```javascript
{ rateLimiterPromise } = redimiter

const options = {
  limit: 20,
  username: this.username,
  action: 'doAction()',
}

rateLimiterPromise({options})
  .then(() => addComment())
  .catch((err) => errorHandler(err))
```
