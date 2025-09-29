import React, { useState, useEffect, useRef, useCallback } from "react";
import { Room, LocalAudioTrack } from "livekit-client";
import { DeepFilterNet3LiveKitProcessor } from "deepfilternet3-client";

export default function App() {
  // State
  const [status, setStatus] = useState("idle");
  const [level, setLevel] = useState(50);
  const [roomConnected, setRoomConnected] = useState(false);
  const [wsUrl, setWsUrl] = useState(process.env.REACT_APP_LIVEKIT_WS_URL || "wss://mmmmmmmmmmmm-dwd0hrri.livekit.cloud");
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
    container: { 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 
      padding: 24, 
      maxWidth: 800,
      margin: "0 auto",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      minHeight: "100vh",
      color: "#333"
    },
    card: {
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: 20,
      padding: 32,
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      marginBottom: 24
    },
    title: {
      fontSize: "2.5rem",
      fontWeight: 700,
      background: "linear-gradient(135deg, #667eea, #764ba2)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      textAlign: "center",
      marginBottom: 32,
      letterSpacing: "-0.02em"
    },
    statusCard: {
      background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      color: "white",
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      boxShadow: "0 10px 30px rgba(240, 147, 251, 0.3)"
    },
    button: { 
      padding: "12px 24px", 
      marginRight: 12, 
      fontSize: 16,
      fontWeight: 600,
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      transition: "all 0.3s ease",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
      "&:hover": {
        transform: "translateY(-2px)",
        boxShadow: "0 8px 25px rgba(102, 126, 234, 0.6)"
      },
      "&:disabled": {
        opacity: 0.6,
        cursor: "not-allowed",
        transform: "none"
      }
    },
    micButton: { 
      padding: "12px 24px", 
      marginRight: 12, 
      fontSize: 16,
      fontWeight: 600,
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      transition: "all 0.3s ease",
      color: "white",
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
      background: micEnabled ? "linear-gradient(135deg, #4CAF50, #45a049)" : "linear-gradient(135deg, #f44336, #d32f2f)"
    },
    input: { 
      width: "100%", 
      marginTop: 12, 
      padding: 16, 
      borderRadius: 12,
      border: "2px solid #e1e5e9",
      fontSize: 16,
      transition: "all 0.3s ease",
      "&:focus": {
        outline: "none",
        borderColor: "#667eea",
        boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.1)"
      }
    },
    slider: { 
      width: "100%", 
      marginTop: 12,
      height: 8,
      borderRadius: 4,
      background: "linear-gradient(90deg, #667eea, #764ba2)",
      outline: "none",
      "&::-webkit-slider-thumb": {
        appearance: "none",
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "white",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
      }
    },
    participantsCard: {
      background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      boxShadow: "0 10px 30px rgba(168, 237, 234, 0.3)"
    },
    participantItem: {
      padding: "16px 20px", 
      margin: "8px 0", 
      borderRadius: 12,
      border: "2px solid transparent",
      transition: "all 0.3s ease",
      background: "rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(10px)"
    },
    speakingParticipant: {
      background: "linear-gradient(135deg, #4CAF50, #45a049)",
      color: "white",
      border: "2px solid #4CAF50",
      transform: "scale(1.02)",
      boxShadow: "0 8px 25px rgba(76, 175, 80, 0.4)"
    },
    audioInfoCard: {
      background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
      borderRadius: 16,
      padding: 24,
      marginTop: 24,
      boxShadow: "0 10px 30px rgba(252, 182, 159, 0.3)"
    },
    debugCard: {
      background: "rgba(255, 255, 255, 0.9)",
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      fontSize: "14px",
      border: "1px solid rgba(0, 0, 0, 0.1)"
    },
    controlGroup: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 24
    },
    label: {
      display: "block",
      fontWeight: 600,
      marginBottom: 8,
      color: "#4a5568"
    },
    inputGroup: {
      marginBottom: 24
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎤 DeepFilterNet3 LiveKit</h1>
        <p style={{ textAlign: "center", fontSize: "1.2rem", color: "#666", marginBottom: 32 }}>
          Real-time AI-powered noise suppression for crystal clear audio
        </p>

        {/* Status */}
        <div style={styles.statusCard}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              backgroundColor: roomConnected ? "#4CAF50" : "#f44336",
              marginRight: 12,
              boxShadow: `0 0 10px ${roomConnected ? "#4CAF50" : "#f44336"}`
            }}></div>
            <strong style={{ fontSize: "1.1rem" }}>Status: {status}</strong>
          </div>
          {roomConnected && (
            <div style={{ fontSize: "1rem", opacity: 0.9 }}>
              <p>✓ Connected to LiveKit room</p>
              <p><strong>Your name:</strong> {myParticipantName}</p>
              <p><strong>Participants:</strong> {participants.length + 1} (including you)</p>
            </div>
          )}
        </div>

        {/* Participants List */}
        {roomConnected && participants.length > 0 && (
          <div style={styles.participantsCard}>
            <h3 style={{ marginTop: 0, color: "#2d3748" }}>👥 Room Participants</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {participants.map((participant, index) => (
                <div 
                  key={index} 
                  style={{ 
                    ...styles.participantItem,
                    ...(participant.isSpeaking ? styles.speakingParticipant : {})
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                      {participant.identity}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {participant.isSpeaking && (
                        <span style={{ 
                          color: participant.isSpeaking ? "white" : "#4CAF50", 
                          fontWeight: "600",
                          fontSize: "0.9rem"
                        }}>
                          🎤 Speaking
                        </span>
                      )}
                      {participant.audioLevel > 0 && (
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 4,
                          color: participant.isSpeaking ? "white" : "#666"
                        }}>
                          <span>🔊</span>
                          <span style={{ fontSize: "0.9rem" }}>
                            {Math.round(participant.audioLevel * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>
            🎛️ Noise Suppression Level: <strong style={{ color: "#667eea" }}>{level}%</strong>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={level}
            onChange={(e) => setLevel(+e.target.value)}
            style={styles.slider}
          />
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            fontSize: "0.9rem", 
            color: "#666",
            marginTop: 8
          }}>
            <span>No suppression</span>
            <span>Maximum suppression</span>
          </div>
        </div>

        {/* LiveKit URL Input */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>🔗 LiveKit Server URL</label>
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            style={styles.input}
            placeholder="wss://your-livekit-server.com"
          />
        </div>

        {/* Control Buttons */}
        <div style={styles.controlGroup}>
          <button 
            onClick={connectToRoom} 
            disabled={roomConnected}
            style={{
              ...styles.button,
              opacity: roomConnected ? 0.6 : 1,
              cursor: roomConnected ? "not-allowed" : "pointer"
            }}
            onMouseEnter={(e) => {
              if (!roomConnected) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.6)";
              }
            }}
            onMouseLeave={(e) => {
              if (!roomConnected) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
              }
            }}
          >
            {roomConnected ? "✅ Connected" : "🚀 Connect to LiveKit Room"}
          </button>
          
          {/* Microphone Toggle Button */}
          {roomConnected && (
            <button 
              onClick={toggleMicrophone}
              style={styles.micButton}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
              }}
            >
              {micEnabled ? "🎤 Mute Mic" : "🎤 Unmute Mic"}
            </button>
          )}
          
          <button 
            onClick={cleanup} 
            disabled={!roomConnected}
            style={{
              ...styles.button,
              background: "linear-gradient(135deg, #f44336, #d32f2f)",
              opacity: !roomConnected ? 0.6 : 1,
              cursor: !roomConnected ? "not-allowed" : "pointer"
            }}
            onMouseEnter={(e) => {
              if (roomConnected) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(244, 67, 54, 0.6)";
              }
            }}
            onMouseLeave={(e) => {
              if (roomConnected) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(244, 67, 54, 0.4)";
              }
            }}
          >
            🔌 Disconnect
          </button>
        </div>
      </div>

      {/* Remote Audio Info */}
      {roomConnected && (
        <div style={styles.audioInfoCard}>
          <h3 style={{ marginTop: 0, color: "#2d3748" }}>🔊 Audio Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            <div>
              <p style={{ margin: "8px 0", fontSize: "1rem" }}>
                🎤 <strong>Your Microphone:</strong> 
                <span style={{ 
                  color: micEnabled ? "#4CAF50" : "#f44336", 
                  fontWeight: "bold",
                  marginLeft: 8
                }}>
                  {micEnabled ? "✅ Enabled" : "❌ Disabled"}
                </span>
                {micEnabled && (
                  <span style={{ color: "#667eea", fontSize: "0.9rem", marginLeft: 8 }}>
                    with DFN3 noise suppression
                  </span>
                )}
              </p>
              <p style={{ margin: "8px 0", fontSize: "1rem" }}>
                🔊 <strong>Your Speakers:</strong> Auto-playing audio from other participants
              </p>
              <p style={{ margin: "8px 0", fontSize: "1rem" }}>
                📡 <strong>Connection:</strong> Real-time audio streaming
              </p>
            </div>
            {participants.length === 0 && (
              <div style={{ 
                padding: 16, 
                background: "rgba(255, 255, 255, 0.7)", 
                borderRadius: 12,
                textAlign: "center"
              }}>
                <p style={{ color: "#666", fontStyle: "italic", margin: 0 }}>
                  👥 No other participants in the room.<br/>
                  Invite others to join to hear audio!
                </p>
              </div>
            )}
          </div>
          
          {/* Debug Info */}
          <div style={styles.debugCard}>
            <h4 style={{ marginTop: 0, color: "#2d3748" }}>🔧 Debug Information</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              <p style={{ margin: "4px 0" }}><strong>Tab ID:</strong> {Date.now()}</p>
              <p style={{ margin: "4px 0" }}><strong>Participant:</strong> {myParticipantName}</p>
              <p style={{ margin: "4px 0" }}>
                <strong>Microphone:</strong> {micEnabled ? "✅ Enabled" : "❌ Disabled"}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Remote Audio:</strong> {remoteAudioRef.current ? "✅ Created" : "❌ Not created"}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Audio Context:</strong> {roomRef.current ? "✅ Connected" : "❌ Not connected"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}