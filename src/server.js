import express from "express";
import { AccessToken } from "livekit-server-sdk";
import cors from "cors";

const app = express();
app.use(cors({
    origin: "http://localhost:3000"
  }));
  

const apiKey = "API2ttpiieJCtZ3";
const apiSecret = "tcMOrvDmbsJfm1ynwiaOPmIXebIeNvfK72IX82d0LV8D";

app.get("/getToken", async (req, res) => {
  const roomName = "key for client"; // tên room
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

app.listen(3001, () => {
  console.log("Token server running on http://localhost:3001");
});
