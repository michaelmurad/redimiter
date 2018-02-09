![assembly2.png](https://s18.postimg.org/b9jh50ieh/assembly2.png)

A simple, customizable Redis middleware and promise based rate limiter for [Node](https://nodejs.org).

## Installation

via [npm](https://github.com/npm/npm)

    $ npm install redimiter

## Usage

Install Redimeter as an npm module and save it to your package.json file:

```javascript
import Redimiter from "redimiter";
```

## Connect to Redis

Now let's create a simple `Redimiter` instance and pass a redis client as an argument:

I recommend the terrific [ioredis](https://github.com/luin/ioredis) Redis client.

```javascript
const redis = new Redis();

const redimiter = new Redimeter(redis);
```

If you pass no arguments to the Redis constructor like above it will automatically connect to a local Redis server which is great for developement.

## Using as express middleware

You can easily add customizable rate limiting on each path using the rateLimiter method:

```javascript
app = express();

const { rateLimiter } = redimiter;

app.get("/pages", rateLimiter("GET/pages", 30000, 20, 1), getPages);

app.post("/cats", rateLimiter("/cats", 20000, 200, 1), postCats);
```

It is based off of [this](https://redis.io/commands/incr) pattern:

    FUNCTION LIMIT_API_CALL(ip)
    ts = CURRENT_UNIX_TIME()
    keyname = ip+":"+ts
    current = GET(keyname)
    IF current != NULL AND current > 10 THEN
    ERROR "too many requests per second"
    ELSE
    MULTI
        INCR(keyname,1)
        EXPIRE(keyname,10)
    EXEC
    PERFORM_API_CALL()
    END

The difference is that this package saves all requests and will ramp up the rate limiting if the client keeps sending requests after rate limiting has begun.
