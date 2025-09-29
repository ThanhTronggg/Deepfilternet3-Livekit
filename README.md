# DeepFilterNet3 LiveKit Noise Suppression

A React application that uses DeepFilterNet3 for real-time audio noise suppression in LiveKit meetings.

**Repository**: [Deepfilternet3-Livekit](https://github.com/ThanhTronggg/Deepfilternet3-Livekit)

## Features

- 🎤 **Real-time audio noise suppression** with DeepFilterNet3
- 🔄 **Adjustable noise suppression level** from 0% to 100%
- 👥 **Participant list display** with speaking status
- 🎛️ **Individual microphone toggle** for each tab
- 📡 **LiveKit integration** for joining meeting rooms

## System Requirements

- Node.js 16+
- Browser with Web Audio API and AudioWorklet support
- Working microphone and speakers
- LiveKit account (free at [livekit.io](https://livekit.io))

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/ThanhTronggg/Deepfilternet3-Livekit.git
cd Deepfilternet3-Livekit/Client_react
npm install
```

### 2. Configure LiveKit

#### Create .env file from template:

```bash
cp env.example .env
```

#### Edit .env file with your LiveKit information:

```env
# LiveKit Configuration
REACT_APP_LIVEKIT_API_KEY=your_livekit_api_key_here
REACT_APP_LIVEKIT_API_SECRET=your_livekit_api_secret_here  
REACT_APP_LIVEKIT_WS_URL=wss://your-livekit-server.livekit.cloud
REACT_APP_LIVEKIT_ROOM_NAME=your_room_name

# Server Configuration
SERVER_PORT=3001
SERVER_CORS_ORIGIN=http://localhost:3000
```

#### Get LiveKit information:

1. Sign up for an account at [livekit.io](https://livekit.io)
2. Create a new project
3. Go to **Settings** → **Keys** to get:
   - **API Key** → replace `your_livekit_api_key_here`
   - **API Secret** → replace `your_livekit_api_secret_here`
   - **WebSocket URL** → replace `your_livekit_server.livekit.cloud`
4. Set room name → replace `your_room_name`

### 3. Run the application

#### Terminal 1 - Run token server:
```bash
npm run server
```

#### Terminal 2 - Run React app:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Usage

### 1. Connect to LiveKit room
- Enter **LiveKit Server URL** (or use value from .env)
- Click **"Connect to LiveKit Room"**
- Allow microphone access when prompted

### 2. Adjust noise suppression
- Use the **"Noise Suppression Level"** slider (0-100%)
- 0% = no noise suppression
- 100% = maximum noise suppression

### 3. Manage microphone
- **"🎤 Mute Mic"** / **"🎤 Unmute Mic"** button to toggle microphone
- Microphone status shows green (enabled) / red (disabled)

### 4. View participants
- Participant list displays in blue frame
- Speaking participants have green border and 🎤 icon
- Audio level shows with 🔊 icon

### 5. Test audio
- Open multiple browser tabs
- Each tab will have different participant names
- Enable mic in one tab, speak into microphone → other tabs will hear it

## File Structure

```
Deepfilternet3-Livekit/
├── Client_react/
│   ├── src/
│   │   ├── App.js              # Main component
│   │   ├── server.js           # LiveKit token server
│   │   └── ...
│   ├── .env                    # Configuration (create from env.example)
│   ├── env.example            # Configuration template
│   ├── package.json           # Dependencies and scripts
│   └── README.md              # This guide
└── ...
```

## Available Scripts

- `npm start` - Run React app (port 3000)
- `npm run server` - Run token server (port 3001)
- `npm run build` - Build for production
- `npm test` - Run tests

## Troubleshooting

### LiveKit connection errors
- Check API Key and Secret in .env file
- Ensure WebSocket URL is correct format: `wss://xxx.livekit.cloud`
- Check if firewall is blocking port 3001

### No audio output
- Check microphone and speakers
- Allow autoplay audio in browser
- Try refreshing page and reconnecting

### DeepFilterNet3 errors
- Ensure browser supports AudioWorklet
- Try Chrome/Edge instead of Firefox
- Check console for detailed error messages

## Technologies Used

- **React 19** - Frontend framework
- **LiveKit** - Real-time communication
- **DeepFilterNet3** - AI noise suppression
- **Express.js** - Token server
- **Web Audio API** - Audio processing

## License

MIT License - See LICENSE file for details.
