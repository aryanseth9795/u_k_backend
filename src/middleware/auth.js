import jwt from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler.js";

// Users Authentication ----->
const isAuthenticated = (req, res, next) => {
  const token = req.cookies["token"];
  if (!token)
    return next(new ErrorHandler("Please login to access this route", 401));
  const user = jwt.verify(token, process.env.JWT_SECRET);

  if (!user) return next(new ErrorHandler("Please login ! Token Expired", 401));
  req.user = user;
  next();
};
export default isAuthenticated;

// admin Routes authentication
export const adminOnly = (req, res, next) => {
  const token = req.cookies["admin-token"];

  if (!token)
    return next(new ErrorHandler("Only Admin can access this route", 401));

  const secretKey = jwt.verify(token, process.env.JWT_SECRET);

  const isMatched = secretKey === adminSecretKey;

  if (!isMatched)
    return next(new ErrorHandler("Only Admin can access this route", 401));
  next();
};