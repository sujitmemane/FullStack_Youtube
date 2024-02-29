import User from "../models/user.model.js";
import { APIError } from "../utils/APIError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyToken = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new APIError(401, "Unauthorized Request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken._id).select(
      "-password -refresToken"
    );
    if (!user) {
      throw new APIError(401, "Invalid Acess Token");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new APIError(401, "Invalid Access Token");
  }
});
