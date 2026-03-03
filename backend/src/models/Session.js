import mongoose from "mongoose"

const sessionSchema = new mongoose.Schema({
    problem: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        required: true
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        role: {
            type: String,
            enum: ["coder", "observer"],
            default: "coder"
        },
        // ADD THIS FIELD
        tabSwitchAllowed: {
            type: Boolean,
            default: undefined // This allows undefined, true, or false
        },
        // Optional: Add violations tracking
        violations: [{
            type: {
                type: String,
                enum: ['tab_switch', 'bot_detection', 'other']
            },
            count: Number,
            timestamp: {
                type: Date,
                default: Date.now
            },
            details: String
        }]
    }],
    maxParticipants: {
        type: Number,
        default: 4
    },
    status: {
        type: String,
        enum: ["pending", "active", "completed", "cancelled"],
        default: "pending"
    },
    callId: {
        type: String,
        default: ""
    },
    // Optional: Add session-level settings
    settings: {
        allowTabSwitchByDefault: {
            type: Boolean,
            default: false
        }
    }
}, { timestamps: true })

const Session = mongoose.model("Session", sessionSchema);
export default Session;