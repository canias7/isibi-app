import React, { useState, useRef, useEffect } from 'react';

/**
 * Test Agent Voice Interface
 * 
 * Allows users to test their AI agent with voice before deploying
 * Shows live transcript of the conversation
 */

export default function TestAgentModal({ agent, token, onClose }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [latency, setLatency] = useState({ current: null, avg: null, samples: 0 });
  const [activeModel, setActiveModel] = useState(null); // confirmed by server
  const [selectedModel, setSelectedModel] = useState(
    agent.model || 'gpt-4o-realtime-preview-2025-06-03'
  );
  const [selectedTtsProvider, setSelectedTtsProvider] = useState(
    agent.tts_provider || 'openai'
  );
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const durationIntervalRef = useRef(null);

  // Save model + TTS provider to agent before starting
  const saveAgentSettings = async () => {
    try {
      await fetch(
        `https://your-backend.onrender.com/api/agents/${agent.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            tts_provider: selectedTtsProvider,
          }),
        }
      );
      agent.model = selectedModel;
      agent.tts_provider = selectedTtsProvider;
    } catch (err) {
      console.warn('Could not save agent settings:', err);
    }
  };

  // Start test call
  const startTest = async () => {
    try {
      setError(null);
      await saveAgentSettings();
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
      
      // Connect to test agent WebSocket
      const wsUrl = `wss://your-backend.onrender.com/test-agent/${agent.id}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('✅ Connected to test agent');
        setIsConnected(true);
        setIsRecording(true);
        startMicrophoneStreaming(stream);
        
        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      };
      
      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Audio chunk from AI
          const audioData = await event.data.arrayBuffer();
          playAudioChunk(audioData);
        } else {
          // JSON event
          const data = JSON.parse(event.data);
          handleServerEvent(data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please try again.');
      };
      
      ws.onclose = () => {
        console.log('❌ Disconnected from test agent');
        setIsConnected(false);
        setIsRecording(false);
        stopMicrophoneStreaming();
        
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      };
      
    } catch (err) {
      console.error('Failed to start test:', err);
      setError('Microphone access denied. Please allow microphone to test your agent.');
    }
  };

  // Stop test call
  const stopTest = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
    }

    stopMicrophoneStreaming();
    setIsConnected(false);
    setIsRecording(false);
    setLatency({ current: null, avg: null, samples: 0 });
    setActiveModel(null);
    setDuration(0);

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  // Start streaming microphone audio
  const startMicrophoneStreaming = (stream) => {
    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    
    processor.onaudioprocess = (e) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Convert Float32Array to Int16Array (PCM16)
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      wsRef.current.send(pcm16.buffer);
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  // Stop microphone streaming
  const stopMicrophoneStreaming = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Play audio chunk from AI
  const playAudioChunk = async (audioData) => {
    audioQueueRef.current.push(audioData);
    
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  };

  // Play next audio chunk in queue
  const playNextChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    
    isPlayingRef.current = true;
    setIsSpeaking(true);
    
    const audioData = audioQueueRef.current.shift();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        playNextChunk();
      };
      
      source.start();
    } catch (err) {
      console.error('Error playing audio:', err);
      playNextChunk();
    }
  };

  // Handle server events
  const handleServerEvent = (data) => {
    const { type } = data;
    
    if (type === 'conversation.item.input_audio_transcription.completed') {
      // User's speech transcribed
      setTranscript(prev => [...prev, {
        role: 'user',
        content: data.transcript,
        timestamp: new Date()
      }]);
    } else if (type === 'response.audio_transcript.delta') {
      // AI's response transcript
      setTranscript(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.complete) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data.delta }
          ];
        } else {
          return [...prev, {
            role: 'assistant',
            content: data.delta,
            timestamp: new Date(),
            complete: false
          }];
        }
      });
    } else if (type === 'response.audio_transcript.done') {
      setTranscript(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, complete: true }
          ];
        }
        return prev;
      });
    } else if (type === 'session.model') {
      setActiveModel(data.model);
    } else if (type === 'latency.update') {
      setLatency({
        current: data.latency_ms,
        avg: data.avg_latency_ms,
        samples: data.samples
      });
    } else if (type === 'error') {
      setError(data.error);
      stopTest();
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Latency quality label and color
  const getLatencyQuality = (ms) => {
    if (ms === null) return { label: '—', color: '#9ca3af' };
    if (ms < 500)  return { label: 'Excellent', color: '#16a34a' };
    if (ms < 1000) return { label: 'Good',      color: '#ca8a04' };
    if (ms < 2000) return { label: 'Fair',       color: '#ea580c' };
    return                 { label: 'Poor',       color: '#dc2626' };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  return (
    <div className="test-agent-modal-overlay" onClick={onClose}>
      <div className="test-agent-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>🎤 Test Agent: {agent.name}</h2>
            <p className="subtitle">Have a voice conversation to test your agent</p>
          </div>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {!isConnected ? (
            /* Start Screen */
            <div className="start-screen">
              <div className="agent-info">
                {/* Brain (model) selector */}
                <div className="info-row model-row">
                  <span className="label">🧠 Brain (Model):</span>
                  <div className="model-selector">
                    <label className={`model-option ${selectedModel === 'gpt-4o-realtime-preview-2025-06-03' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="agentModel"
                        value="gpt-4o-realtime-preview-2025-06-03"
                        checked={selectedModel === 'gpt-4o-realtime-preview-2025-06-03'}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      />
                      <span className="model-name">GPT-4o Realtime</span>
                      <span className="model-tag">Recommended</span>
                    </label>
                    <label className={`model-option ${selectedModel === 'gpt-4o-mini-realtime-preview' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="agentModel"
                        value="gpt-4o-mini-realtime-preview"
                        checked={selectedModel === 'gpt-4o-mini-realtime-preview'}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      />
                      <span className="model-name">GPT-4o Mini Realtime</span>
                      <span className="model-tag tag-mini">Faster · Cheaper</span>
                    </label>
                    <label className={`model-option ${selectedModel === 'gpt-4o' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="agentModel"
                        value="gpt-4o"
                        checked={selectedModel === 'gpt-4o'}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      />
                      <span className="model-name">GPT-4o</span>
                      <span className="model-tag tag-classic">Classic · Flexible TTS</span>
                    </label>
                  </div>
                </div>

                {/* TTS provider — only visible when GPT-4o brain is selected */}
                {selectedModel === 'gpt-4o' && (
                  <div className="info-row model-row">
                    <span className="label">🔊 Voice Output (TTS):</span>
                    <div className="model-selector">
                      <label className={`model-option ${selectedTtsProvider === 'openai' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="ttsProvider"
                          value="openai"
                          checked={selectedTtsProvider === 'openai'}
                          onChange={(e) => setSelectedTtsProvider(e.target.value)}
                        />
                        <span className="model-name">OpenAI TTS</span>
                        <span className="model-tag">Fast · Natural</span>
                      </label>
                      <label className={`model-option ${selectedTtsProvider === 'elevenlabs' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="ttsProvider"
                          value="elevenlabs"
                          checked={selectedTtsProvider === 'elevenlabs'}
                          onChange={(e) => setSelectedTtsProvider(e.target.value)}
                        />
                        <span className="model-name">ElevenLabs</span>
                        <span className="model-tag tag-mini">Ultra-realistic</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="info-row">
                  <span className="label">🎙️ Voice:</span>
                  <span className="value">{agent.voice || 'alloy'}</span>
                </div>
                <div className="info-row">
                  <span className="label">📝 Prompt:</span>
                  <span className="value">{agent.system_prompt?.substring(0, 100)}...</span>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              <button onClick={startTest} className="start-test-btn">
                🎙️ Start Test Call
              </button>

              <div className="info-box">
                <p><strong>💡 How it works:</strong></p>
                <p>Click the button above to start a voice call with your agent. You'll be able to speak naturally and hear how your agent responds.</p>
              </div>
            </div>
          ) : (
            /* Active Call Screen */
            <div className="active-call">
              {/* Status */}
              <div className="call-status">
                <div className="status-indicator">
                  {isSpeaking ? (
                    <div className="speaking-animation">
                      <div className="wave"></div>
                      <div className="wave"></div>
                      <div className="wave"></div>
                      <div className="wave"></div>
                      <div className="wave"></div>
                    </div>
                  ) : (
                    <div className="listening-animation">
                      <div className="pulse"></div>
                      <div className="microphone">🎙️</div>
                    </div>
                  )}
                </div>
                
                <p className="status-text">
                  {isSpeaking ? `${agent.name} is speaking...` : "Listening... speak now"}
                </p>
                
                <p className="duration">⏱️ {formatDuration(duration)}</p>

                {/* Active model badge */}
                {activeModel && (
                  <p className="active-model-badge">
                    🧠 {activeModel === 'gpt-4o-mini-realtime-preview'
                      ? 'GPT-4o Mini Realtime'
                      : activeModel === 'gpt-4o'
                      ? `GPT-4o + ${agent.tts_provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI TTS'}`
                      : 'GPT-4o Realtime'}
                  </p>
                )}

                {/* Latency metrics */}
                <div className="latency-metrics">
                  <div className="latency-item">
                    <span className="latency-label">Response Latency</span>
                    <span
                      className="latency-value"
                      style={{ color: getLatencyQuality(latency.current).color }}
                    >
                      {latency.current !== null ? `${latency.current} ms` : '—'}
                    </span>
                  </div>
                  <div className="latency-divider" />
                  <div className="latency-item">
                    <span className="latency-label">Avg Latency</span>
                    <span
                      className="latency-value"
                      style={{ color: getLatencyQuality(latency.avg).color }}
                    >
                      {latency.avg !== null ? `${latency.avg} ms` : '—'}
                    </span>
                  </div>
                  <div className="latency-divider" />
                  <div className="latency-item">
                    <span className="latency-label">Quality</span>
                    <span
                      className="latency-badge"
                      style={{ background: getLatencyQuality(latency.current).color }}
                    >
                      {getLatencyQuality(latency.current).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="test-transcript">
                <h4>Conversation Transcript</h4>
                <div className="transcript-messages">
                  {transcript.length === 0 ? (
                    <p className="empty-state">Start speaking to test your agent</p>
                  ) : (
                    transcript.map((msg, idx) => (
                      <div key={idx} className={`transcript-msg ${msg.role}`}>
                        <div className="msg-role">
                          {msg.role === 'user' ? '👤 You' : `🤖 ${agent.name}`}
                        </div>
                        <div className="msg-content">{msg.content}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* End Button */}
              <button onClick={stopTest} className="end-test-btn">
                ❌ End Test Call
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .test-agent-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .test-agent-modal {
          background: white;
          border-radius: 16px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 24px;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 22px;
        }

        .subtitle {
          margin: 6px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .modal-content {
          padding: 32px;
          overflow-y: auto;
        }

        .start-screen {
          text-align: center;
        }

        .agent-info {
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .label {
          font-weight: 600;
          color: #6b7280;
        }

        .value {
          color: #1f2937;
          text-align: right;
          max-width: 60%;
        }

        .start-test-btn {
          padding: 16px 48px;
          font-size: 18px;
          font-weight: 600;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s;
          margin: 24px 0;
        }

        .start-test-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .error-message {
          background: #fee2e2;
          color: #dc2626;
          padding: 12px 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .info-box {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 16px;
          text-align: left;
          color: #0369a1;
        }

        .info-box p {
          margin: 0 0 8px 0;
        }

        .info-box p:last-child {
          margin: 0;
        }

        .call-status {
          text-align: center;
          padding: 32px 0;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 24px;
        }

        .status-indicator {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .speaking-animation {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
        }

        .wave {
          width: 6px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 3px;
          animation: wave 1.2s ease-in-out infinite;
        }

        .wave:nth-child(1) { animation-delay: 0s; }
        .wave:nth-child(2) { animation-delay: 0.1s; }
        .wave:nth-child(3) { animation-delay: 0.2s; }
        .wave:nth-child(4) { animation-delay: 0.3s; }
        .wave:nth-child(5) { animation-delay: 0.4s; }

        @keyframes wave {
          0%, 100% { height: 20px; }
          50% { height: 80px; }
        }

        .listening-animation {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pulse {
          position: absolute;
          width: 100px;
          height: 100px;
          border: 3px solid #667eea;
          border-radius: 50%;
          animation: pulse 2s ease-out infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        .microphone {
          font-size: 50px;
          position: relative;
          z-index: 1;
        }

        .status-text {
          margin: 16px 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #667eea;
        }

        .duration {
          font-size: 14px;
          color: #6b7280;
        }

        .model-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }

        .model-selector {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .model-option {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 12px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          position: relative;
        }

        .model-option input[type="radio"] {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .model-option.selected,
        .model-option:has(input:checked) {
          border-color: #667eea;
          background: #f0f0ff;
        }

        .model-option:hover {
          border-color: #a5b4fc;
        }

        .model-name {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
        }

        .model-tag {
          font-size: 11px;
          font-weight: 600;
          color: #667eea;
          background: #ede9fe;
          padding: 2px 8px;
          border-radius: 999px;
        }

        .model-tag.tag-mini {
          color: #059669;
          background: #d1fae5;
        }

        .model-tag.tag-classic {
          color: #b45309;
          background: #fef3c7;
        }

        .active-model-badge {
          margin: 6px 0 0 0;
          font-size: 12px;
          font-weight: 600;
          color: #667eea;
          background: #ede9fe;
          display: inline-block;
          padding: 3px 12px;
          border-radius: 999px;
        }

        .latency-metrics {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-top: 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px 24px;
        }

        .latency-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 0 20px;
        }

        .latency-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #9ca3af;
        }

        .latency-value {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          transition: color 0.3s;
        }

        .latency-badge {
          font-size: 12px;
          font-weight: 600;
          color: white;
          padding: 3px 10px;
          border-radius: 999px;
          transition: background 0.3s;
        }

        .latency-divider {
          width: 1px;
          height: 36px;
          background: #e5e7eb;
        }

        .test-transcript {
          margin-bottom: 24px;
        }

        .test-transcript h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
        }

        .transcript-messages {
          background: #f9fafb;
          border-radius: 12px;
          padding: 16px;
          max-height: 300px;
          overflow-y: auto;
        }

        .empty-state {
          text-align: center;
          color: #9ca3af;
          padding: 32px 16px;
        }

        .transcript-msg {
          margin-bottom: 12px;
          padding: 10px;
          border-radius: 8px;
        }

        .transcript-msg.user {
          background: #ede9fe;
          border-left: 4px solid #7c3aed;
        }

        .transcript-msg.assistant {
          background: #dbeafe;
          border-left: 4px solid #3b82f6;
        }

        .msg-role {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .msg-content {
          font-size: 14px;
          line-height: 1.5;
        }

        .end-test-btn {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          font-weight: 600;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
        }

        .end-test-btn:hover {
          background: #b91c1c;
        }
      `}</style>
    </div>
  );
}
