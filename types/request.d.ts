declare module 'express-serve-static-core' {
  interface Request {
    fileValidationError?: string;
  }
}
