// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    profileImage: {
        type: String,
        default: ""
    },
    clerkId: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        required: true,
        default: "user",
        enum: ["user", "admin", "hr"] // Changed moderator to hr
    }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;