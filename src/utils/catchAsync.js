/**
 * Wraps an async route handler to forward unhandled rejections to next(err)
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
