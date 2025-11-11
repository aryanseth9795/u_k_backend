import jwt from "jsonwebtoken";
import { cookieOptions } from "../app.js";

const sendToken = async (res, user, code, message) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "5d",
  });

  res.status(code).cookie("token", token, cookieOptions).json({
    success: true,
    message,
  });
};

export default sendToken;