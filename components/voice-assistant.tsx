"use client";

import { createPortal } from "react-dom";
import { Mic, PhoneOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  TOPBAR_PANEL_EVENT,
  announceTopbarPanel,
  readTopbarPanel,
} from "@/components/topbar-panel-events";
import { siteConfig } from "@/site.config";

type VoiceStatus = "idle" | "connecting" | "connected" | "error";
type VoicePreset = "female" | "male";
type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

type RealtimeEvent = {
  type?: string;
  item_id?: string;
  response_id?: string;
  transcript?: string;
  delta?: string;
  text?: string;
  item?: {
    id?: string;
    role?: string;
    content?: Array<{
      text?: string;
      transcript?: string;
      type?: string;
    }>;
  };
  error?: {
    message?: string;
  };
};

export function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [message, setMessage] = useState("");
  const [voicePreset, setVoicePreset] = useState<VoicePreset>("female");
  const [history, setHistory] = useState<VoiceTurn[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    function handleTopbarPanelOpen(event: Event) {
      const panel = readTopbarPanel(event);

      if (panel && panel !== "audio") {
        setIsOpen(false);
      }
    }

    window.addEventListener(TOPBAR_PANEL_EVENT, handleTopbarPanelOpen);

    return () => {
      window.removeEventListener(TOPBAR_PANEL_EVENT, handleTopbarPanelOpen);
    };
  }, []);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ block: "end" });
  }, [history, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => stopVoiceSession();
  }, []);

  async function startVoiceSession() {
    if (
      !siteConfig.voiceAssistant.enabled ||
      status === "connected" ||
      status === "connecting"
    ) {
      return;
    }

    setStatus("connecting");
    setMessage("Connecting");

    try {
      const sessionResponse = await fetch(siteConfig.voiceAssistant.sessionEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ voicePreset }),
      });
      const session = await sessionResponse.json();

      if (!sessionResponse.ok || typeof session.value !== "string") {
        throw new Error(
          session.error || siteConfig.voiceAssistant.unavailableMessage,
        );
      }

      const peerConnection = new RTCPeerConnection();
      const audio = document.createElement("audio");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const dataChannel = peerConnection.createDataChannel("oai-events");

      audio.autoplay = true;
      peerConnection.ontrack = (event) => {
        audio.srcObject = event.streams[0];
      };
      dataChannel.onmessage = (event) => {
        handleRealtimeEvent(parseRealtimeEvent(event.data));
      };

      peerConnection.addTrack(stream.getAudioTracks()[0], stream);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.value}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error("The Realtime session could not start.");
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });

      audioRef.current = audio;
      dataChannelRef.current = dataChannel;
      peerConnectionRef.current = peerConnection;
      streamRef.current = stream;
      setStatus("connected");
      setMessage("Listening");
    } catch (error) {
      stopVoiceSession();
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : siteConfig.voiceAssistant.unavailableMessage,
      );
    }
  }

  function stopVoiceSession() {
    dataChannelRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    dataChannelRef.current = null;
    streamRef.current = null;
    peerConnectionRef.current = null;
    audioRef.current = null;
    setStatus("idle");
    setMessage("");
  }

  function handleRealtimeEvent(event: RealtimeEvent | null) {
    if (!event?.type) {
      return;
    }

    if (event.type === "error") {
      setStatus("error");
      setMessage(event.error?.message || "The audio session returned an error.");
      return;
    }

    if (event.type === "input_audio_buffer.speech_started") {
      setMessage("Listening");
      return;
    }

    if (event.type === "input_audio_buffer.speech_stopped") {
      setMessage("Thinking");
      return;
    }

    if (event.type === "output_audio_buffer.started") {
      setMessage("Speaking");
      return;
    }

    if (event.type === "output_audio_buffer.stopped") {
      setMessage("Listening");
      setHistory((current) =>
        current.map((turn) =>
          turn.role === "assistant" ? { ...turn, pending: false } : turn,
        ),
      );
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.delta") {
      updateHistory({
        id: event.item_id || "user-live",
        role: "user",
        content: event.delta || "",
        append: true,
        pending: true,
      });
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      updateHistory({
        id: event.item_id || createId(),
        role: "user",
        content: event.transcript || "",
        append: false,
        pending: false,
      });
      return;
    }

    if (event.type === "response.output_audio_transcript.delta") {
      updateHistory({
        id: event.response_id || "assistant-live",
        role: "assistant",
        content: event.delta || "",
        append: true,
        pending: true,
      });
      return;
    }

    if (event.type === "response.output_audio_transcript.done") {
      updateHistory({
        id: event.response_id || createId(),
        role: "assistant",
        content: event.transcript || "",
        append: false,
        pending: false,
      });
      return;
    }

    if (event.type === "response.output_text.delta") {
      updateHistory({
        id: event.response_id || "assistant-live",
        role: "assistant",
        content: event.delta || "",
        append: true,
        pending: true,
      });
      return;
    }

    if (event.type === "response.output_text.done") {
      updateHistory({
        id: event.response_id || createId(),
        role: "assistant",
        content: event.text || "",
        append: false,
        pending: false,
      });
      return;
    }

    if (event.type === "response.output_item.done" && event.item) {
      const content = event.item.content
        ?.map((part) => part.text || part.transcript || "")
        .filter(Boolean)
        .join("\n");

      if (content) {
        updateHistory({
          id: event.item.id || createId(),
          role: event.item.role === "user" ? "user" : "assistant",
          content,
          append: false,
          pending: false,
        });
      }
    }
  }

  function updateHistory({
    append,
    content,
    id,
    pending,
    role,
  }: {
    append: boolean;
    content: string;
    id: string;
    pending: boolean;
    role: VoiceTurn["role"];
  }) {
    if (!content.trim()) {
      return;
    }

    setHistory((current) => {
      const existing = current.find((turn) => turn.id === id);

      if (!existing) {
        return [
          ...current,
          {
            id,
            role,
            content,
            pending,
          },
        ];
      }

      return current.map((turn) =>
        turn.id === id
          ? {
              ...turn,
              content: append ? `${turn.content}${content}` : content,
              pending,
            }
          : turn,
      );
    });
  }

  function handleClose() {
    setIsOpen(false);
  }

  const isActive = status === "connected";
  const isBusy = status === "connecting";
  const panel =
    isOpen && hasMounted
      ? createPortal(
          <div className="voice-panel-shell" role="presentation">
            <button
              className="voice-panel-scrim"
              type="button"
              aria-label="Close audio assistant"
              onClick={handleClose}
            />
            <aside
              aria-label="Audio assistant"
              aria-modal="true"
              className="voice-panel"
              role="dialog"
            >
              <header className="voice-panel-header">
                <span className="assistant-panel-icon" aria-hidden="true">
                  <Mic size={18} />
                </span>
                <div>
                  <strong>Audio</strong>
                  <span>{message || "Voice chat for the docs"}</span>
                </div>
                <button type="button" aria-label="Close audio" onClick={handleClose}>
                  <X size={18} aria-hidden="true" />
                </button>
              </header>

              <div className="voice-panel-body">
                <div className="voice-presets" aria-label="Voice preset">
                  <button
                    type="button"
                    aria-pressed={voicePreset === "female"}
                    disabled={isActive || isBusy}
                    onClick={() => setVoicePreset("female")}
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    aria-pressed={voicePreset === "male"}
                    disabled={isActive || isBusy}
                    onClick={() => setVoicePreset("male")}
                  >
                    Male
                  </button>
                </div>

                {!siteConfig.voiceAssistant.enabled ? (
                  <div className="assistant-notice">
                    Set <code>NEXT_PUBLIC_DOCS_VOICE_ASSISTANT=true</code>,{" "}
                    <code>DOCS_VOICE_ASSISTANT_ENABLED=true</code>, and{" "}
                    <code>OPENAI_API_KEY</code>, then restart the dev server.
                  </div>
                ) : null}

                <div className="voice-history" aria-label="Audio chat history">
                  {history.length > 0 ? (
                    history.map((turn) => (
                      <div
                        key={turn.id}
                        className="voice-turn"
                        data-role={turn.role}
                        data-pending={turn.pending || undefined}
                      >
                        <strong>{turn.role === "user" ? "You" : "Docs"}</strong>
                        <p>{turn.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="assistant-empty">
                      Your audio transcript appears here while you talk.
                    </div>
                  )}
                  <div ref={historyEndRef} />
                </div>
              </div>

              <footer className="voice-panel-footer">
                {isActive ? (
                  <button type="button" onClick={stopVoiceSession}>
                    <PhoneOff size={17} aria-hidden="true" />
                    Stop audio
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!siteConfig.voiceAssistant.enabled || isBusy}
                    onClick={() => void startVoiceSession()}
                  >
                    <Mic size={17} aria-hidden="true" />
                    {isBusy ? "Connecting" : "Start audio"}
                  </button>
                )}
              </footer>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="docs-tool-button docs-audio-button"
        aria-expanded={isOpen}
        data-status={status}
        onClick={() => {
          announceTopbarPanel("audio");
          setIsOpen(true);
        }}
      >
        <Mic size={16} aria-hidden="true" />
        <span>Audio</span>
      </button>
      {panel}
    </>
  );
}

function parseRealtimeEvent(value: string): RealtimeEvent | null {
  try {
    return JSON.parse(value) as RealtimeEvent;
  } catch {
    return null;
  }
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}
