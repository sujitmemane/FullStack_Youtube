import { APIError } from "../utils/APIError.js";
import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import {
  deleteImageCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { APIResponse } from "../utils/APIResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();

    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({
      validateBeforeSave: false,
    });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new APIError(
      500,
      "Something went wrong while generating refresh or access token"
    );
  }
};

export const registerUser = asyncHandler(async function (req, res) {
  const { fullName, email, username, password } = req.body;
  console.log("files", req?.files);
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new APIError(400, "All Fields are compulsory");
  }

  console.log("1");
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new APIError(409, "User with email or username already exist");
  }
  console.log("2");
  console.log("filses", req.files.avatar[0]);
  const avatarLocalPath = await req.files?.avatar[0]?.path;
  console.log("avatar local path", avatarLocalPath);
  console.log("3");
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new APIError(400, "Avatar Image is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new APIError(400, "Avatar Link Image is required");
  }
  const user = await User.create({
    fullName,
    avatar: avatar?.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new APIError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new APIResponse(201, createdUser, "User Created Successfully"));
});

export const loginUser = asyncHandler(async function (req, res) {
  const { email, username, password } = req.body;
  if (!(email || username)) {
    throw new APIError(400, "Username or Password is required");
  }
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (!user) {
    throw new APIError(404, "User does not exist");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new APIError(404, "Invalid User Credential");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user?._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new APIResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully"
      )
    );
});

export const logoutUser = asyncHandler(async function (req, res) {
  await User.findByIdAndUpdate(req?.user?._id, {
    $set: {
      refreshToken: undefined,
    },
  });
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new APIResponse(200, {}, "User Logout Successfull"));
});

export const refreshAccessToken = asyncHandler(async function (req, res) {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new APIError(401, "Unauthorized Request");
  }
  try {
    const { _id } = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(_id);
    if (!user) {
      throw new APIError(401, "Invalid Refresh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new APIError("Refresh token is used and expired");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new APIResponse(200, {
          accessToken,
          refreshToken,
        })
      );
  } catch (error) {
    throw new APIError(401, error?.message);
  }
});

export const changeUserPassword = asyncHandler(async function (req, res) {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req?.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new APIError(400, "Invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new APIResponse(200, {}, "Password changes successfully"));
});

export const getCurrentUser = asyncHandler(async function (req, res) {
  return res
    .status(200)
    .json(new APIResponse(200, req.user, "User fetched successfully"));
});

export const updateUserInfo = asyncHandler(async function (req, res) {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new APIError(400, "All fields are necessary");
  }
  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  );
  return res
    .status(200)
    .json(new APIResponse(200, user, "User Information updated successfully"));
});

export const updateUserAvatar = asyncHandler(async function (req, res) {
  const avatarLocalPath = req?.file?.path;
  if (!avatarLocalPath) {
    throw new APIError(404, "Avatart file is missinng");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar?.url) {
    throw new APIError(400, "Error while uploading avatar");
  }
  const user = await User.findByIdAndUpdate(
    req?.user?.id,
    {
      $set: {
        avatar: avatar?.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  await deleteImageCloudinary(avatar?.url);
  return res
    .status(200)
    .json(new APIResponse(200, user, "Avatart Updated Successfully"));
});

export const updateUserCoverImage = asyncHandler(async function (req, res) {
  const coverImageLocalPath = req?.file?.path;
  if (!coverImageLocalPath) {
    throw new APIError(404, "Cover Image file is missinng");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage?.url) {
    throw new APIError(400, "Error while uploading Cover Image");
  }
  const user = await User.findByIdAndUpdate(
    req?.user?.id,
    {
      $set: {
        coverImage: coverImage?.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  await deleteImageCloudinary(coverImage?.url);
  return res
    .status(200)
    .json(new APIResponse(200, user, "Cover Image Updated Successfully"));
});
