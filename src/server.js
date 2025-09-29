import express from "express";
import { AccessToken } from "livekit-server-sdk";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
app.use(cors({
    origin: process.env.SERVER_CORS_ORIGIN || "http://localhost:3000"
  }));
  

const apiKey = process.env.REACT_APP_LIVEKIT_API_KEY;
const apiSecret = process.env.REACT_APP_LIVEKIT_API_SECRET;

app.get("/getToken", async (req, res) => {
  const roomName = process.env.REACT_APP_LIVEKIT_ROOM_NAME || "key for client"; // tên room
  // Tạo unique identity với timestamp và random number
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000);
  const participantName = `user-${timestamp}-${randomNum}`;

  console.log(`Creating token for participant: ${participantName}`);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    ttl: '10m',
  });

  at.addGrant({ 
    roomJoin: true, 
    room: roomName,
    canPublish: true,
    canSubscribe: true
  });

  const token = await at.toJwt();

  res.json({ 
    token: token,
    participantName: participantName,
    roomName: roomName
  });
});

app.listen(process.env.SERVER_PORT || 3001, () => {
  console.log(`Token server running on http://localhost:${process.env.SERVER_PORT || 3001}`);
});
