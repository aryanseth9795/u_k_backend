import express from "express";
import {
  SignUp,
  acceptFriendRequest,
  getNotification,
  login,
  logout,
  myProfile,
  searchUser,
  sendFriendRequest,
  update,
} from "../controllers/userController.js";
import isAuthenticated from "../middlewares/auth.js";


const router = express.Router();

//tested routes

router.route("/signup").post( SignUp);
router.route("/login").post(login);

router.use(isAuthenticated);
router.route("/me").get(myProfile);
router.route("/update").put(update); 
router.route("/logout").get(logout);

router.route("/search").get(searchUser);
router.route("/searchsuggestions").get(searchUser);

router.route("/getnotification").get(getNotification);


export default router;