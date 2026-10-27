/**
 * Async Route Immunity Wrapper
 * Guarantees that any asynchronous rejection or thrown exception in Express route handlers
 * is safely trapped and forwarded to the central error handling middleware, preventing hung requests.
 */

function asyncHandler(fn) {
  return function asyncRouteHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
