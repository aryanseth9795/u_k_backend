import TryCatch from "../middlewares/tryCatch.js";
import sendToken from "../utils/SendToken.js";
import { cookieOptions } from "../app.js";
import { User } from "../models/userModels.js";
import { Chat } from "../models/chatModel.js";
import { Request } from "../models/requestModel.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import { compare } from "bcrypt";
import UploadToCloudinary from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import emitEvent from "../utils/emitEvent.js";
import {
  NEW_NOTIFICATION_ALERT,
  PROFILE_UPDATED,
  REFETCH_CHATS,
} from "../constants/event.js";

// Creating  a new user and save it to the database and save token in cookie
export const SignUp = TryCatch(async (req, res, next) => {
  const { name, phone, password, email } = req.body;

  const isAvailable = await User.findOne({ $or: [{ email }, { phone }] });
  if (isAvailable) {
    return next(
      new ErrorHandler("User with given email or phone already exists", 400)
    );
  }

  const user = await User.create({
    name,
    phone,
    password,
    email,
  });

  res.status(201).json({
    success: true,
    message: "User created successfully, Login to continue",
  
  });
  //   sendToken(res, user, 201, "User created");
});

export const login = TryCatch(async (req, res, next) => {
  const { phoneorEmail, password } = req.body;
  const user = await User.findOne({ $or: [{ email: phoneorEmail }, { phone: phoneorEmail }] }).select("name password");
  if (!user) {
    return next(new ErrorHandler("Invalid Username or Password", 401));
  }
  const isMatched = await compare(password, user?.password);
  if (!isMatched) {
    return next(new ErrorHandler("Incorrect Password", 401));
  }
  sendToken(res, user, 201, `Login Successfully ${user.name}`);
});

export const myProfile = TryCatch(async (req, res, next) => {
  const userwithoutCount = await User.findById(req.user.id);
  const notificationCount = await Request.countDocuments({
    receiver: req.user.id,
  });
  if (!userwithoutCount) {
    return next("Error in fetching user details", 401);
  }

  const user = { ...userwithoutCount.toObject(), notificationCount };

  res.status(200).json({
    success: true,
    user,
  });
});

export const update = TryCatch(async (req, res, next) => {
  // check username is already taken
  const usernameexist = await User.findOne({ username: req?.body?.username });

  // checking username is same as previous or not
  if (
    usernameexist &&
    usernameexist._id.toString() !== req.user.id.toString()
  ) {
    return next(new ErrorHandler("Username already taken", 401));
  }

  const existuser = await User.findById(req.user.id);
  if (!existuser) {
    return next(new ErrorHandler("User not found", 401));
  }
  const file = req.file;

  if (file) {
    //uploading new avatar
    const cloudinaryResult = await UploadToCloudinary([file]);
    req.body.avatar = {
      public_id: cloudinaryResult[0].public_id,
      url: cloudinaryResult[0].url,
    };

    // deletion of previous avatar
    if (existuser?.avatar?.public_id) {
      await cloudinary.uploader.destroy(existuser?.avatar?.public_id);
    }
  }

  if (Object.keys(req.body).length === 0) {
    return next(new ErrorHandler("No data to update", 401));
  }

  const newUser = await User.findByIdAndUpdate(req.user.id, req.body, {
    new: true,
  });

  if (!newUser) {
    return next(new ErrorHandler("Error in updating user details", 401));
  }

  emitEvent(req, PROFILE_UPDATED);
  res.status(200).json({
    success: true,
    message: "Profile Updated Successfully",
    newUser,
  });
});
export const logout = TryCatch(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", { ...cookieOptions, maxAge: 0 })
    .json({
      success: true,
      message: "Logout Successfully !",
    });
});

export const searchUser = TryCatch(async (req, res, next) => {
  const { name = "" } = req.query;

  // Finding all my chats
  const myChats = await Chat.find({ groupChat: false, members: req.user.id });

  // Extracting all users from my chats (friends or people I've chatted with)

  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

  // Finding all users except me and my friends
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: [...allUsersFromMyChats, req.user.id] },
    $or: [
      { name: { $regex: name, $options: "i" } },
      { username: { $regex: name, $options: "i" } },
    ],
  });

  // Fetching users to whom the current user has already sent friend requests
  const sentRequests = await Request.find({ sender: req.user.id }).select(
    "receiver"
  );

  const sentRequestUserIds = sentRequests.map((req) => req.receiver.toString());

  // Modifying the response
  const users = allUsersExceptMeAndFriends.map(
    ({ _id, name, avatar, username }) => ({
      _id,
      name,
      avatar: avatar.url,
      username,
      request: sentRequestUserIds.includes(_id.toString()), // Add request flag if already sent
    })
  );

  return res.status(200).json({
    success: true,
    users,
  });
});

// Send Friend Request
export const sendFriendRequest = TryCatch(async (req, res, next) => {
  const { userId } = req.body;

  const request = await Request.findOne({
    $or: [
      { sender: req.user.id, receiver: userId },
      { sender: userId, receiver: req.user.id },
    ],
  });

  if (request) return next(new ErrorHandler("Request already sent", 400));

  await Request.create({
    sender: req.user.id,
    receiver: userId,
  });

  const user = await User.findById(userId).select("name");

  emitEvent(req, NEW_NOTIFICATION_ALERT, [userId]);

  return res.status(200).json({
    success: true,
    message: `Friend Request Sent to ${user.name}`,
  });
});

export const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;

  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");

  if (!request) return next(new ErrorHandler("Request not found", 404));

  if (request.receiver._id.toString() !== req.user.id.toString())
    return next(
      new ErrorHandler("You are not authorized to accept this request", 401)
    );

  if (!accept) {
    await request.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }

  const members = [request.sender._id, request.receiver._id];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name}-${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  res.status(200).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
  });
});

export const getNotification = TryCatch(async (req, res, next) => {
  const allRequests = await Request.find({ receiver: req.user.id })
    .select("sender")
    .populate("sender", " name username avatar");

  if (!allRequests) {
    next(new ErrorHandler("No Friend Requests", 401));
  }
  res.status(200).json({
    success: true,
    allRequests,
  });
});
