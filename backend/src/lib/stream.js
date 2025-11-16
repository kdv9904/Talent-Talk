import {StreamChat} from "stream-chat"
import { ENV } from './env.js';
import {StreamClient} from "@stream-io/node-sdk";

const apiKey = ENV.STREAM_API_KEY;
const apiSecret = ENV.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
    throw new Error("Stream API key and secret must be set in environment variables.");
}

export const chatClient = StreamChat.getInstance(apiKey, apiSecret);                               
export const streamClient = new StreamClient(apiKey, apiSecret);

export const upsertStreamUser = async (userData) => {
    try {
        await chatClient.upsertUser([userData]);
        return userData;
    } catch (error) {
        console.error("Error upserting Stream user:", error);
        throw error;
    }
}

export const deleteStreamUser = async (userId) => {
    try {
        await chatClient.deleteUser(userId);
        console.log(`User ${userId} deleted successfully.`);
    } catch (error) {
        console.error("Error deleting Stream user:", error);
        throw error;
    }
}