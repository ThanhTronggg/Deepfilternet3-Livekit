import React, { useState, useEffect, useRef, useCallback } from "react";
import { Room, LocalAudioTrack } from "livekit-client";
import { DeepFilterNet3LiveKitProcessor } from "deepfilternet3-client";

export default function App() {
  // State
  const [status, setStatus] = useState("idle");
  const [level, setLevel] = useState(50);
  const [roomConnected, setRoomConnected] = useState(false);
  const [wsUrl, setWsUrl] = useState("wss://mmmmmmmmmmmm-dwd0hrri.livekit.cloud");
  const [participants, setParticipants] = useState([]);
  const [myParticipantName, setMyParticipantName] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);

  // Refs
  const roomRef = useRef(null);
  const livekitProcessorRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Helper functions
  const fetchToken = async () => {
    const resp = await fetch("http://localhost:3001/getToken");
    const { token, participantName, roomName } = await resp.json();
    console.log("Token:", token, "Participant:", participantName, "Room:", roomName);
    return { token, participantName, roomName };
  };

  const setupAudioContext = async () => {
    const audioContext = new AudioContext({ 
      sampleRate: 48000,
      latencyHint: 'interactive'
    });
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    console.log("AudioContext state:", audioContext.state);
    return audioContext;
  };

  const setupAudioTrack = async (audioContext) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      }
    });

    const audioTrack = stream.getAudioTracks()[0];
    const localAudioTrack = new LocalAudioTrack(audioTrack, {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    }, false, audioContext);

    return { localAudioTrack, stream };
  };

  const setupRemoteAudio = () => {
    const remoteAudioElement = document.createElement('audio');
    remoteAudioElement.autoplay = true;
    remoteAudioElement.playsInline = true;
    remoteAudioElement.style.display = 'none';
    document.body.appendChild(remoteAudioElement);
    return remoteAudioElement;
  };

  const setupRoomEvents = (room, remoteAudioElement) => {
    room.on('participantConnected', (participant) => {
      console.log('Participant connected:', participant.identity);
    });

    room.on('participantDisconnected', (participant) => {
      console.log('Participant disconnected:', participant.identity);
    });

    room.on('trackSubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        console.log('Audio track subscribed from:', participant.identity);
        remoteAudioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
      }
    });

    room.on('trackUnsubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        console.log('Audio track unsubscribed from:', participant.identity);
      }
    });
  };

  // Main joinRoom function
  const joinRoom = async (wsUrl, suppressionLevel = 50) => {
    try {
      const { token } = await fetchToken();
      
      const room = new Room();
      await room.connect(wsUrl, token);
      console.log("Connected as", room.localParticipant.identity);
      
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      
      const audioContext = await setupAudioContext();
      const { localAudioTrack } = await setupAudioTrack(audioContext);
      
      const processor = new DeepFilterNet3LiveKitProcessor({});
      await localAudioTrack.setProcessor(processor);
      processor.setSuppressionLevel(suppressionLevel);
      
      await room.localParticipant.publishTrack(localAudioTrack);
      
      const remoteAudioElement = setupRemoteAudio();
      setupRoomEvents(room, remoteAudioElement);
      
      console.log("Joined room with DeepFilterNet3 noise filter enabled:", room.name);
      return { room, processor, remoteAudioElement };
    } catch (error) {
      console.error('joinRoom error:', error);
      throw error;
    }
  };

  const cleanup = useCallback(async () => {
    try { 
      livekitProcessorRef.current?.destroy?.(); 
      await roomRef.current?.disconnect(); 
      remoteAudioRef.current?.remove(); 
    } catch { }
    
    roomRef.current = livekitProcessorRef.current = remoteAudioRef.current = null;
    setRoomConnected(false);
    setParticipants([]);
    setMyParticipantName("");
    setMicEnabled(true);
    setStatus("idle");
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);


  const updateParticipants = useCallback(() => {
    if (!roomRef.current) return;
    
    const participantList = Array.from(roomRef.current.remoteParticipants.values()).map(p => ({
      identity: p.identity,
      isSpeaking: p.isSpeaking,
      audioLevel: p.audioLevel
    }));
    setParticipants(participantList);
  }, []);

  const connectToRoom = useCallback(async () => {
    if (roomConnected) return;
    
    try {
      setStatus("connecting to room…");
      const { room, processor, remoteAudioElement } = await joinRoom(wsUrl, level);
      
      roomRef.current = room;
      livekitProcessorRef.current = processor;
      remoteAudioRef.current = remoteAudioElement;
      
      // Set up participant tracking
      room.on('participantConnected', updateParticipants);
      room.on('participantDisconnected', updateParticipants);
      room.on('participantMetadataChanged', updateParticipants);
      
      updateParticipants();
      setMyParticipantName(room.localParticipant.identity);
      setRoomConnected(true);
      setStatus("connected to room with DFN3 noise suppression");
    } catch (e) {
      setStatus("room error: " + (e?.message || String(e)));
    }
  }, [roomConnected, wsUrl, level, updateParticipants]);

  const toggleMicrophone = useCallback(async () => {
    if (!roomConnected || !roomRef.current) return;
    
    try {
      const newMicState = !micEnabled;
      await roomRef.current.localParticipant.setMicrophoneEnabled(newMicState);
      setMicEnabled(newMicState);
      setStatus(newMicState ? "Microphone enabled" : "Microphone disabled");
    } catch (e) {
      setStatus("Mic toggle error: " + (e?.message || String(e)));
    }
  }, [roomConnected, micEnabled]);

  // Update suppression level for LiveKit room when level changes
  useEffect(() => {
    if (!roomConnected || !livekitProcessorRef.current) return;
    
    try {
      livekitProcessorRef.current.setSuppressionLevel(level);
      console.log(`Suppression level changed to ${level}% for LiveKit room`);
    } catch (e) {
      console.error("Failed to update suppression level:", e);
    }
  }, [level, roomConnected]);

  // UI Constants
  const styles = {
    container: { fontFamily: "sans-serif", padding: 16, maxWidth: 600 },
    button: { padding: "10px 20px", marginRight: 10, fontSize: 16 },
    micButton: { 
      padding: "10px 20px", 
      marginRight: 10, 
      fontSize: 16,
      backgroundColor: micEnabled ? "#4CAF50" : "#f44336",
      color: "white",
      border: "none",
      borderRadius: 4
    },
    input: { width: "100%", marginTop: 8, padding: 8 },
    slider: { width: "100%", marginTop: 8 }
  };

  return (
    <div style={styles.container}>
      <h1>DeepFilterNet3 LiveKit Noise Suppression</h1>

      {/* Status */}
      <div style={{ marginBottom: 20 }}>
        <p><strong>Trạng thái:</strong> {status}</p>
        {roomConnected && (
          <div>
            <p style={{ color: "green" }}>✓ Đã kết nối phòng LiveKit</p>
            <p><strong>Tên của bạn:</strong> {myParticipantName}</p>
            <p><strong>Số người tham gia:</strong> {participants.length + 1} (bao gồm bạn)</p>
          </div>
        )}
      </div>

      {/* Participants List */}
      {roomConnected && participants.length > 0 && (
        <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#f0f8ff", borderRadius: 8 }}>
          <h3>Người tham gia trong phòng:</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {participants.map((participant, index) => (
              <li key={index} style={{ 
                padding: "8px 12px", 
                margin: "4px 0", 
                backgroundColor: participant.isSpeaking ? "#e6ffe6" : "#fff",
                borderRadius: 4,
                border: participant.isSpeaking ? "2px solid #4CAF50" : "1px solid #ddd"
              }}>
                <span style={{ fontWeight: "bold" }}>{participant.identity}</span>
                {participant.isSpeaking && (
                  <span style={{ color: "#4CAF50", marginLeft: 10 }}>🎤 Đang nói</span>
                )}
                {participant.audioLevel > 0 && (
                  <span style={{ color: "#666", marginLeft: 10 }}>
                    🔊 {Math.round(participant.audioLevel * 100)}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Noise Suppression Level */}
      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>Mức độ khử nhiễu:</strong> {level}%
          <input
            type="range"
            min="0"
            max="100"
            value={level}
            onChange={(e) => setLevel(+e.target.value)}
            style={styles.slider}
          />
        </label>
      </div>

      {/* LiveKit URL Input */}
      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>LiveKit Server URL:</strong>
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            style={styles.input}
            placeholder="wss://your-livekit-server.com"
          />
        </label>
      </div>

      {/* Control Buttons */}
      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={connectToRoom} 
          disabled={roomConnected}
          style={styles.button}
        >
          {roomConnected ? "Đã kết nối" : "Kết nối phòng LiveKit"}
        </button>
        
        {/* Microphone Toggle Button */}
        {roomConnected && (
          <button 
            onClick={toggleMicrophone}
            style={styles.micButton}
          >
            {micEnabled ? "🎤 Tắt Mic" : "🎤 Bật Mic"}
          </button>
        )}
        
        <button 
          onClick={cleanup} 
          disabled={!roomConnected}
          style={styles.button}
        >
          Ngắt kết nối
        </button>
      </div>

      {/* Remote Audio Info */}
      {roomConnected && (
        <div style={{ marginTop: 20, padding: 15, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
          <h3>Thông tin âm thanh:</h3>
          <p>
            🎤 <strong>Microphone của bạn:</strong> 
            <span style={{ color: micEnabled ? "#4CAF50" : "#f44336", fontWeight: "bold" }}>
              {micEnabled ? " Đã bật" : " Đã tắt"}
            </span>
            {micEnabled && " với khử nhiễu DFN3"}
          </p>
          <p>🔊 <strong>Loa của bạn:</strong> Tự động phát âm thanh từ những người khác</p>
          <p>📡 <strong>Kết nối:</strong> Real-time audio streaming</p>
          {participants.length === 0 && (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              Chưa có ai khác trong phòng. Mời người khác tham gia để nghe âm thanh!
            </p>
          )}
          
          {/* Debug Info */}
          <div style={{ marginTop: 15, padding: 10, backgroundColor: "#fff", borderRadius: 4, fontSize: "12px" }}>
            <h4>Debug Info:</h4>
            <p><strong>Tab ID:</strong> {Date.now()}</p>
            <p><strong>Participant:</strong> {myParticipantName}</p>
            <p><strong>Microphone:</strong> {micEnabled ? "✓ Enabled" : "✗ Disabled"}</p>
            <p><strong>Remote Audio Element:</strong> {remoteAudioRef.current ? "✓ Created" : "✗ Not created"}</p>
            <p><strong>Audio Context:</strong> {roomRef.current ? "✓ Connected" : "✗ Not connected"}</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ marginTop: 30, padding: 15, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
        <h3>Hướng dẫn sử dụng:</h3>
        <ul>
          <li><strong>LiveKit Mode:</strong> Kết nối với phòng họp LiveKit với khử nhiễu tự động</li>
          <li>Điều chỉnh mức độ khử nhiễu từ 0% (không khử) đến 100% (khử tối đa)</li>
          <li>Bạn sẽ tự động nghe âm thanh từ những người khác trong phòng</li>
          <li>Danh sách người tham gia sẽ hiển thị ai đang nói và mức độ âm thanh</li>
          <li><strong>Mở nhiều tab:</strong> Mỗi tab sẽ có participant name khác nhau và có thể nghe lẫn nhau</li>
          <li><strong>Nút Microphone:</strong> Có thể bật/tắt microphone riêng cho từng tab</li>
          <li><strong>Test âm thanh:</strong> Bật mic ở tab này, nói vào mic, tab khác sẽ nghe được</li>
          <li>Đảm bảo trình duyệt hỗ trợ Web Audio API và AudioWorklet</li>
          <li>Đảm bảo microphone và loa của bạn hoạt động bình thường</li>
        </ul>
      </div>
    </div>
  );
}