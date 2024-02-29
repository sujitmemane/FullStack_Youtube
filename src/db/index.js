import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGO_URI}/${DB_NAME}`
    );
    console.log(`MongoDBConnected ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("MongoDB Connection Failed", error);
    process.exit(1);
  }
};
