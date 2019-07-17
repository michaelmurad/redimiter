function ErrorGen(message: string, name: string = "Error") {
  this.name = name;
  this.message = message;
}

export const rateError: Error = new ErrorGen(
  "You are doing this too much, try again in a little bit"
);

export const overdriveRateErr: Error = new ErrorGen(
  "You are doing this WAY too much, try again much later"
);

// CONSTRUCTOR ERRORS
export const constrErr: Error = new ErrorGen("You need to add a redis client");

// RATE_LIMITER ERRORS
export const rLPathErr: string = "rateLimiter({ path }) must be a string";

export const rLLimitErr: Error = new ErrorGen(
  "rateLimiter({ limit }) must be a positive int"
);

export const rLExpErr: Error = new ErrorGen(
  "rateLimiter({ expire }) must be a positive int"
);

// RATE_LIMITER_PROMISE ERRORS
export const rLPUsernameErr: Error = new ErrorGen(
  "there is no username, please set options.username"
);

export const rLPActionErr: Error = new ErrorGen(
  "there is no action, please set options.action"
);

export const rLPLimitErr: Error = new ErrorGen(
  "rateLimiterPromise({ limit }) must be a positive int"
);

export const rLPExpErr: Error = new ErrorGen(
  "rateLimiterPromise({ expire }) must be a positive int"
);

export function errorFunc(res, err) {
  res.status(500).send(err);
  return res.end();
}
