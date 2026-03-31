'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  IconChevronCompactDown,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconPhoneOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconVideo,
  IconVideoOff,
} from '@tabler/icons-react'
import type { VisualState } from '@/features/conversation/types/visual-state.types'
import { PabloPresenter } from './PabloPresenter'
import { getPresenterPlaybackMode } from './presenter-playback'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

interface VoiceOrbSessionProps {
  messages: Message[]
  assistantSpeaking: boolean
  isListening: boolean
  isProcessing: boolean
  isConnected: boolean
  isConnecting?: boolean
  connectionError?: string | null
  sessionStatus: string | null
  isSttSupported: boolean
  isSttPermissionBlocked: boolean
  transcript?: string
  interimTranscript: string
  sttError: string | null
  sttCommitRemainingMs: number
  sttCommitProgress: number
  textInput: string
  isMobile: boolean
  onHangUp: () => void
  onMicrophoneClick: () => void
  onSendText: () => void
  onTextInputChange: (v: string) => void
  onScheduleIdleHints: () => void
  onTurnHelp?: (turn: Message) => void
  analyserRef?: React.RefObject<AnalyserNode | null>
  audioElementRef?: React.RefObject<HTMLAudioElement | null>
  onPauseReplay?: () => void
  currentAudioUrl?: string | null
  // resume prompt (replaces Mantine Modal)
  resumePromptOpen?: boolean
  entryPromptMode?: 'resume' | 'retake' | null
  onResume?: () => void
  onStartOver?: () => void
  startOverLoading?: boolean
  mode?: 'voice' | 'text' | 'video'
  activeObjections?: Array<{ id: string; args: Record<string, unknown> }>
  latestNextStep?: { id: string; args: Record<string, unknown> } | null
  avatarVideoUrl?: string | null
  avatarVideoStatus?: 'idle' | 'queued' | 'rendering' | 'ready' | 'failed'
  avatarVideoError?: string | null
  videoRef?: React.RefObject<HTMLVideoElement | null>
  // video-mode camera controls
  cameraEnabled?: boolean
  onToggleCamera?: () => void
  userVideoRef?: React.RefObject<HTMLVideoElement | null>
  personaAvatarImageUrl?: string | null
  presenterTone?: string | null
  presenterIsFrustrated?: boolean
  // page-level props forwarded but not consumed here
  globeState?: unknown
  onTextInputKeyPress?: unknown
  isVideoSession?: unknown
  avatarVideoJobId?: unknown
  avatarVideoProvider?: unknown
  visualState?: VisualState | null
  poseIsReady?: boolean
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
.container-vao {
  position: relative;
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── panel open ─── */
.container-vao.vos-open .container-chat-ia {
  width:  max(70vw, 320px);
  height: max(70vh, 400px);
  filter: blur(0px);
  opacity: 1;
  transform: translateY(-5vh);
}
.container-vao.vos-open .orb {
  filter: drop-shadow(0 0 12px rgba(145,71,255,.3)) drop-shadow(0 0 5px rgba(255,0,0,.3));
  transform-origin: center center;
  transform: translate(-50%, calc(max(35vh, 200px) + 10px - 5vh));
}
.container-vao.vos-open .orb:hover  { transform: translate(-50%, calc(max(35vh, 200px) + 10px - 5vh)) scale(1.1); }
.container-vao.vos-open .orb:active { transform: translate(-50%, calc(max(35vh, 200px) + 10px - 5vh)) scale(0.9); }

/* ─── mobile: near-fullscreen panel ─── */
@media (max-width: 640px) {
  .container-vao.vos-open .container-chat-ia {
    width:  calc(100vw - 18px);
    height: calc(100dvh - 230px);
    transform: translateY(-2vh);
  }
  .container-vao.vos-open .orb {
    transform: translate(-50%, calc(50dvh - 78px));
  }
  .container-vao.vos-open .orb:hover  { transform: translate(-50%, calc(50dvh - 78px)) scale(1.1); }
  .container-vao.vos-open .orb:active { transform: translate(-50%, calc(50dvh - 78px)) scale(0.9); }
}

/* ─── panel closed ─── */
.container-vao:not(.vos-open) .orb {
  filter:
    drop-shadow(0 0 4px rgba(255,255,255,1))
    drop-shadow(0 0 12px rgba(255,255,255,1))
    drop-shadow(0 0 12px rgba(145,71,255,.3))
    drop-shadow(0 0 5px rgba(255,0,0,.3));
  transform: scale(1.2) translate(-50%, -50%);
}
.container-vao:not(.vos-open) .orb .ball {
  animation: vos-circle2 4.2s ease-in-out infinite;
}
.container-vao:not(.vos-open) .orb:hover {
  transform: scale(1.4) translate(-50%, -50%);
}
.container-vao:not(.vos-open) .orb:active {
  transform: scale(1.2) translate(-50%, -50%);
}
.container-vao:not(.vos-open) .container-lines,
.container-vao:not(.vos-open) .container-rings::before,
.container-vao:not(.vos-open) .container-rings::after {
  animation: none;
}

@keyframes vos-circle2 {
  0%   { transform: scale(1.5);  }
  15%  { transform: scale(1.53); }
  30%  { transform: scale(1.48); }
  45%  { transform: scale(1.44); }
  60%  { transform: scale(1.47); }
  85%  { transform: scale(1.53); }
  100% { transform: scale(1.5);  }
}

/* ─── chat panel base ─── */
.container-chat-ia {
  opacity: 0;
  filter: blur(50px);
  display: flex;
  flex-direction: column;
  width: 64px;
  height: 64px;
  padding: .5rem;
  border-radius: 2rem;
  box-shadow: 6px 6px 12px rgba(255,0,2,.1), -6px 6px 12px rgba(59,130,246,.1);
  gap: 4px;
  transition: all .6s cubic-bezier(.175,.885,.32,1.1);
  background: rgba(255,255,255,.97);
  overflow: hidden;
}

/* ─── title bar ─── */
.container-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .35rem .6rem .2rem;
  flex-shrink: 0;
}
.vos-panel-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #d4d4d8;
  flex: 1;
}
.vos-collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  color: #d4d4d8;
  line-height: 1;
  transition: color .2s, background .2s;
  flex-shrink: 0;
}
.vos-collapse-btn:hover { color: #ffffff; background: rgba(255,255,255,.08); }

/* ─── status bar ─── */
.vos-status-bar {
  --vos-status-bg: rgba(107,114,128,.07);
  --vos-status-color: #9ca3af;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 12px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
  border-radius: 100px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  background: var(--vos-status-bg);
  color: var(--vos-status-color);
  transition: background 0.4s ease, color 0.4s ease, border-color 0.4s ease;
  flex-shrink: 0;
}
.vos-status-bar.status-speaking  { --vos-status-bg: rgba(59,130,246,.10); --vos-status-color: #3b82f6; }
.vos-status-bar.status-thinking  { --vos-status-bg: rgba(139,92,246,.10); --vos-status-color: #8b5cf6; }
.vos-status-bar.status-listening { --vos-status-bg: rgba(16,185,129,.10); --vos-status-color: #10b981; }
.vos-status-bar.status-idle      { --vos-status-bg: rgba(107,114,128,.07); --vos-status-color: #9ca3af; }
.vos-status-bar.vos-turn-timer {
  border-color: rgba(52, 211, 153, 0.22);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.16);
  isolation: isolate;
}
.vos-status-bar.vos-turn-timer::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: conic-gradient(
    from -90deg,
    rgba(52, 211, 153, 0.95) 0turn,
    rgba(52, 211, 153, 0.95) calc(var(--vos-turn-progress, 0) * 1turn),
    rgba(52, 211, 153, 0.15) calc(var(--vos-turn-progress, 0) * 1turn),
    rgba(52, 211, 153, 0.15) 1turn
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* thinking dots */
.vos-dots { display: flex; gap: 2px; align-items: center; }
.vos-dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: currentColor;
  animation: vos-dot-bounce 1.3s ease-in-out infinite;
}
.vos-dot:nth-child(2) { animation-delay: .16s; }
.vos-dot:nth-child(3) { animation-delay: .32s; }
@keyframes vos-dot-bounce {
  0%,80%,100% { transform: scale(.6); opacity: .35; }
  40%         { transform: scale(1.3); opacity: 1; }
}

/* speaking bars */
.vos-bars { display: flex; gap: 1px; align-items: center; height: 9px; }
.vos-bar {
  width: 2px;
  border-radius: 2px;
  background: currentColor;
  animation: vos-bar-grow .9s ease-in-out infinite;
}
.vos-bar:nth-child(1) { height: 3px; animation-delay: 0s; }
.vos-bar:nth-child(2) { height: 6px; animation-delay: .12s; }
.vos-bar:nth-child(3) { height: 9px; animation-delay: .24s; }
.vos-bar:nth-child(4) { height: 6px; animation-delay: .12s; }
.vos-bar:nth-child(5) { height: 3px; animation-delay: 0s; }
@keyframes vos-bar-grow {
  0%,100% { transform: scaleY(.35); opacity: .55; }
  50%     { transform: scaleY(1.1); opacity: 1; }
}

/* listening mic pulse */
.vos-mic-pulse {
  position: relative;
  width: 10px; height: 10px;
  display: flex; align-items: center; justify-content: center;
}
.vos-mic-pulse::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  opacity: .5;
  animation: vos-pulse-ring 1.4s ease-out infinite;
}
@keyframes vos-pulse-ring {
  0%   { transform: scale(.8); opacity: .6; }
  100% { transform: scale(2);  opacity: 0; }
}

/* idle dot */
.vos-idle-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: .6;
}

/* ─── chat body ─── */
.container-chat {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
  font-size: 13px;
  background-image: linear-gradient(to top left, rgba(255,0,2,.22), rgba(59,130,246,.22));
  border-radius: 1.5rem;
  overflow: hidden;
}
.container-chat::after {
  position: absolute;
  content: "";
  inset: 0;
  background: repeating-conic-gradient(
    rgba(255,255,255,.2) .0000001%,
    rgba(232,232,232,.8) .000104%
  ) 60% 60%/600% 600%;
  pointer-events: none;
}
.container-chat-limit {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-mask: linear-gradient(0deg, white 85%, transparent 95% 100%);
  mask: linear-gradient(0deg, white 85%, transparent 95% 100%);
  z-index: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,.15) transparent;
}
.chats {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem 1rem;
  gap: .4rem;
}
.chats > :first-child {
  margin-top: 2rem;
}

/* ─── messages ─── */
.chat-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.chat-user p {
  opacity: 0;
  transform: translateY(10px);
  max-width: 85%;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: .25rem;
  line-height: 1.5;
  padding: .55rem .75rem;
  color: #1f2937;
  border-radius: .6rem .6rem 0 .6rem;
  background-color: rgba(255,255,255,.62);
  animation: vos-chat 1s calc(var(--delay,0) * 1s) both cubic-bezier(.175,.885,.32,1.275);
}
.chat-user p span {
  opacity: 0;
  transform: translateY(10px);
  display: inline-block;
  animation: vos-chat 1s calc(var(--delay,0) * 1s + var(--word,0) * .1s) both cubic-bezier(.175,.885,.32,1.275);
}
.chat-ia {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.chat-ia p {
  opacity: 0;
  transform: translateY(10px);
  max-width: 85%;
  display: flex;
  flex-wrap: wrap;
  gap: .25rem;
  line-height: 1.5;
  padding: .55rem 0;
  color: rgba(255,255,255,.94);
  animation: vos-chat 1s calc(var(--delay,0) * 1s) both cubic-bezier(.175,.885,.32,1.275);
}
.chat-ia p span {
  opacity: 0;
  color: rgba(244, 244, 245, 0.96) !important;
  transform: translateY(10px);
  display: inline-block;
  animation: vos-chat 1s calc(var(--delay,0) * 1s + var(--word,0) * .1s) both cubic-bezier(.175,.885,.32,1.275);
}
.vos-turn-help-btn {
  margin-top: 7px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.14);
  color: rgba(226, 232, 240, 0.95);
  font-size: 12px;
  line-height: 1.2;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.vos-turn-help-btn::before {
  content: '✦';
  font-size: 10px;
  opacity: .85;
}
.vos-turn-help-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(96, 165, 250, 0.55);
  color: #dbeafe;
}
.chat-user .vos-turn-help-btn {
  align-self: flex-end;
}
.chat-ia .vos-turn-help-btn {
  align-self: flex-start;
}
@keyframes vos-chat {
  100% { opacity: 1; transform: translateY(0); }
}

/* ─── controls row ─── */
.vos-controls {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 10px 14px 6px;
  margin: 0 auto;
  flex-shrink: 0;
  z-index: 2;
}
.vos-btn {
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
  flex-shrink: 0;
}
.vos-btn:hover  { transform: scale(1.1); }
.vos-btn:active { transform: scale(0.93); }
.vos-btn:disabled { opacity: .32; cursor: not-allowed; transform: none !important; }

.vos-btn-mic {
  width: 44px; height: 44px;
  background: rgba(0,0,0,.08);
  color: #374151;
}
.vos-btn-mic.listening {
  background: #10b981;
  color: #fff;
  box-shadow: 0 0 14px rgba(16,185,129,.45);
}
/* ─── interrupt state: AI is speaking, mic = tap to cut in ─── */
.vos-btn-mic.can-interrupt {
  background: rgba(245,158,11,.12);
  color: #f59e0b;
  animation: vos-interrupt-pulse 1.6s ease-in-out infinite;
}
.vos-btn-mic.can-interrupt:hover { background: rgba(245,158,11,.22); }
@keyframes vos-interrupt-pulse {
  0%,100% { box-shadow: 0 0 0 0   rgba(245,158,11,.45); }
  50%      { box-shadow: 0 0 0 7px rgba(245,158,11,.0); }
}
.vos-btn-hangup {
  width: 56px; height: 56px;
  background: #ff0002;
  color: #fff;
  box-shadow: 0 4px 14px rgba(255,0,2,.35);
}
.vos-btn-hangup:hover { box-shadow: 0 6px 20px rgba(255,0,2,.5); }
.vos-btn-replay {
  width: 44px; height: 44px;
  background: rgba(0,0,0,.08);
  color: #374151;
}
.vos-btn-replay.active {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 0 14px rgba(59,130,246,.45);
}

/* ─── text input ─── */
.vos-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 10px;
  background: rgba(255,255,255,.75);
  border-top: 1px solid rgba(0,0,0,.07);
  flex-shrink: 0;
  z-index: 2;
}
.vos-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
  outline: none;
  padding: 3px 0;
}
.vos-input::placeholder { color: #6b7280; }
.vos-input:disabled     { opacity: .45; }
.vos-send {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #3b82f6;
  padding: 2px 5px;
  border-radius: 4px;
  line-height: 1;
  transition: background .2s;
}
.vos-send:hover    { background: rgba(59,130,246,.1); }
.vos-send:disabled { opacity: .3; cursor: not-allowed; }

/* ─── attempt checkpoint modal ─── */
.vos-prompt-modal {
  position: absolute;
  inset: 0;
  z-index: 1000000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.vos-prompt-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3,7,18,.58);
  backdrop-filter: blur(10px);
}
.vos-prompt-modal-card {
  position: relative;
  width: min(420px, calc(100vw - 32px));
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(18px);
  border-radius: 22px;
  padding: 20px 20px 18px;
  border: 1px solid rgba(59,130,246,.12);
  box-shadow: 0 20px 60px rgba(0,0,0,.28), 0 6px 16px rgba(0,0,0,.12);
  animation: vos-modal-in .22s ease-out both;
}
@keyframes vos-modal-in {
  from { opacity: 0; transform: translateY(10px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.vos-bubble-heading {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px;
}
.vos-bubble-desc {
  font-size: 11px;
  color: #666;
  line-height: 1.5;
  margin: 0 0 12px;
}
.vos-bubble-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.vos-bubble-btn {
  border: none;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  transition: transform .12s ease, box-shadow .12s ease;
}
.vos-bubble-btn:hover  { transform: scale(1.04); }
.vos-bubble-btn:active { transform: scale(.96); }
.vos-bubble-btn:disabled { opacity: .45; cursor: not-allowed; transform: none !important; }
.vos-bubble-btn-secondary { background: rgba(0,0,0,.06); color: #555; }
.vos-bubble-btn-primary {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  box-shadow: 0 3px 10px rgba(59,130,246,.3);
}

/* ─── orb ─── */
.orb {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: left top;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
  display: flex;
  transition: all .5s cubic-bezier(.175,.885,.32,1.275);
  cursor: pointer;
  z-index: 999999;
  user-select: none;
}
.icons {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  display: flex;
  z-index: 999;
  transition: opacity .3s ease;
}
.icons .svg {
  width: 24px; height: 24px;
  flex-shrink: 0;
  transition: opacity .3s ease, filter .3s ease;
}
.vos-listening .icons .svg { opacity: 1; filter: drop-shadow(0 0 4px #fff); }
.container-vao:not(.vos-open) .icons .svg { opacity: .6; }

/* ─── ball ─── */
.ball {
  display: flex;
  width: 64px; height: 64px;
  flex-shrink: 0;
  border-radius: 50px;
  background-color: var(--vos-ball-color, #ff0002);
  filter: url(#vos-gooey);
  transition: background-color .4s ease;
}

/* ─── morphing shape — border-radius gives smooth organic curves ─── */
.container-lines {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(1);
  width: 56px; height: 56px;
  background-image: radial-gradient(ellipse at center, rgba(255,255,255,.75) 15%, #3b82f6 55%);
  border-radius: 50%;
  animation: vos-morph 8s ease-in-out infinite;
  animation-play-state: paused;
  pointer-events: none;
}
@keyframes vos-morph {
  0%,100% { border-radius: 50%; }
  12%     { border-radius: 62% 38% 46% 54% / 54% 46% 62% 38%; }
  25%     { border-radius: 38% 62% 60% 40% / 60% 40% 38% 62%; }
  37%     { border-radius: 54% 46% 38% 62% / 42% 58% 54% 46%; }
  50%     { border-radius: 44% 56% 56% 44% / 58% 42% 46% 54%; }
  62%     { border-radius: 60% 40% 44% 56% / 38% 62% 60% 40%; }
  75%     { border-radius: 36% 64% 52% 48% / 56% 44% 36% 64%; }
  87%     { border-radius: 56% 44% 36% 64% / 44% 56% 52% 48%; }
}

/* ─── orb status label (visible only when panel is closed) ─── */
.vos-orb-label {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(0);
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 3px 10px;
  border-radius: 100px;
  background: rgba(0,0,0,.5);
  backdrop-filter: blur(6px);
  pointer-events: none;
  transition: opacity .35s ease, transform .35s ease;
}
.container-vao.vos-open .vos-orb-label {
  opacity: 0;
  transform: translateX(-50%) translateY(-5px);
}
.container-vao:not(.vos-open) .vos-orb-label {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.vos-orb-label.status-speaking  { color: #60a5fa; }
.vos-orb-label.status-thinking  { color: #a78bfa; }
.vos-orb-label.status-listening { color: #34d399; }
.vos-orb-label.status-idle      { color: rgba(255,255,255,.55); }

/* ─── rings ─── */
.container-rings {
  aspect-ratio: 1;
  border-radius: 50%;
  position: absolute;
  inset: 0;
  perspective: 11rem;
}
.container-rings::before,
.container-rings::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 6px solid transparent;
  mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  background: linear-gradient(white, blue, magenta, violet, lightyellow) border-box;
  mask-composite: exclude;
}
.container-rings::before { animation: vos-ring180 10s linear infinite; }
.container-rings::after  { animation: vos-ring90  10s linear infinite; }
@keyframes vos-ring180 {
  0%   { transform: rotateY(180deg) rotateX(180deg) rotateZ(180deg); }
  50%  { transform: rotateY(360deg) rotateX(360deg) rotateZ(360deg) scale(1.1); }
  100% { transform: rotateY(540deg) rotateX(540deg) rotateZ(540deg); }
}
@keyframes vos-ring90 {
  0%   { transform: rotateY(90deg)  rotateX(90deg)  rotateZ(90deg);  }
  50%  { transform: rotateY(270deg) rotateX(270deg) rotateZ(270deg) scale(1.1); }
  100% { transform: rotateY(450deg) rotateX(450deg) rotateZ(450deg); }
}

/* ══════════════════════════════════════════════════════════════════
   Dark mode overrides — triggered by html.dark (set by providers.tsx)
   ══════════════════════════════════════════════════════════════════ */

html.dark .container-chat-ia {
  background: rgba(16, 17, 22, 0.97);
  box-shadow: 6px 6px 12px rgba(255,0,2,.05), -6px 6px 12px rgba(59,130,246,.05);
}
html.dark .container-chat {
  background-image: linear-gradient(to top left, rgba(255,0,2,.10), rgba(59,130,246,.10));
}
html.dark .container-chat::after {
  background: repeating-conic-gradient(
    rgba(255,255,255,.03) .0000001%,
    rgba(30,31,38,.7) .000104%
  ) 60% 60%/600% 600%;
}

/* messages */
html.dark .chat-user p {
  background-color: rgba(96,165,250,.14);
  color: rgba(240,249,255,.96);
}
html.dark .chat-ia p { color: rgba(244,244,245,.94); }
html.dark .vos-turn-help-btn {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(125, 211, 252, 0.3);
  color: rgba(219, 234, 254, 0.96);
}
html.dark .vos-turn-help-btn:hover {
  background: rgba(96, 165, 250, 0.24);
  border-color: rgba(125, 211, 252, 0.55);
  color: #dbeafe;
}

/* title bar */
html.dark .vos-panel-name  { color: #d4d4d8; }
html.dark .vos-collapse-btn { color: #cbd5e1; }
html.dark .vos-collapse-btn:hover { color: #fff; background: rgba(255,255,255,.08); }

/* status bar — colours stay; only tweak the idle background */
html.dark .vos-status-bar.status-idle { background: rgba(107,114,128,.12); }

/* input row */
html.dark .vos-input-row {
  background: rgba(14, 14, 20, 0.9);
  border-top: 1px solid rgba(255,255,255,.06);
}
html.dark .vos-input             { color: #f4f4f5; }
html.dark .vos-input::placeholder{ color: #a1a1aa; }
html.dark .vos-send              { color: #60a5fa; }
html.dark .vos-send:hover        { background: rgba(59,130,246,.12); }

/* control buttons */
html.dark .vos-btn-mic    { background: rgba(255,255,255,.09); color: #e4e4e7; }
html.dark .vos-btn-replay { background: rgba(255,255,255,.09); color: #e4e4e7; }

/* attempt checkpoint modal */
html.dark .vos-prompt-modal-backdrop { background: rgba(2,6,23,.72); }
html.dark .vos-prompt-modal-card {
  background: rgba(22,22,30,.97);
  border-color: rgba(96,165,250,.16);
  box-shadow: 0 24px 70px rgba(0,0,0,.48), 0 8px 20px rgba(0,0,0,.3);
}
html.dark .vos-bubble-heading { color: #e4e4e7; }
html.dark .vos-bubble-desc    { color: #cbd5e1; }
html.dark .vos-bubble-btn-secondary { background: rgba(255,255,255,.08); color: #f4f4f5; }

/* ─── text mode: no orb, always-open full panel ─── */
.vos-text-mode .orb  { display: none; }
.vos-text-mode.container-vao { align-items: stretch; }
.vos-text-mode .container-chat-ia {
  width: 100% !important; height: 100% !important;
  opacity: 1 !important; filter: none !important;
  transform: none !important; border-radius: 1.5rem;
}
.vos-text-mode .container-title { display: none; }

/* ─── video mode: Zoom-like full layout ─── */
.vos-zoom-layout {
  display: flex; flex-direction: column;
  width: 100%; height: 100%;
  background: #0f0f13; border-radius: 1.5rem; overflow: hidden;
}

/* Main avatar video */
.vos-zoom-video-area {
  position: relative; flex: 1; min-height: 0;
  background: #111118; display: flex;
  align-items: center; justify-content: center;
}
.vos-zoom-video-area > video { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Loading / error overlay */
.vos-zoom-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; font-size: 13px; font-weight: 600;
}
.vos-zoom-spinner {
  width: 28px; height: 28px;
  border: 2.5px solid rgba(255,255,255,.15);
  border-top-color: #3b82f6; border-radius: 50%;
  animation: vos-spin .85s linear infinite;
}
@keyframes vos-spin { to { transform: rotate(360deg); } }

/* Status pill (speaking / thinking) */
.vos-zoom-status {
  position: absolute; top: 12px; left: 50%;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 100px;
  font-size: 12px; font-weight: 600;
  backdrop-filter: blur(10px); background: rgba(0,0,0,.55);
  white-space: nowrap; z-index: 10;
}
.vos-zoom-status.status-speaking  { color: #60a5fa; }
.vos-zoom-status.status-thinking  { color: #a78bfa; }
.vos-zoom-status.status-listening { color: #34d399; }
.vos-zoom-status.status-idle      { color: rgba(255,255,255,.78); }

/* User camera PiP */
.vos-zoom-pip {
  position: absolute; bottom: 16px; right: 16px;
  width: 220px; height: 150px;
  border-radius: 12px; overflow: hidden;
  border: 2px solid rgba(255,255,255,.22);
  background: #1e1e2a; z-index: 10;
  box-shadow: 0 6px 24px rgba(0,0,0,.6);
}
.vos-zoom-pip > video {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
  transform: scaleX(-1); /* mirror selfie */
}
.vos-zoom-pip-off {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  color: rgba(255,255,255,.62); font-size: 10px; font-weight: 600;
}

/* Transcript */
.vos-zoom-transcript {
  flex-shrink: 0; height: 160px;
  background: rgba(6,10,22,.72);
  border-top: 1px solid rgba(255,255,255,.12);
  overflow-y: auto; padding: 10px 14px;
  display: flex; flex-direction: column; gap: 5px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.1) transparent;
  /* fade top edge so it blends into video */
  -webkit-mask: linear-gradient(0deg, white 80%, transparent 100%);
  mask: linear-gradient(0deg, white 80%, transparent 100%);
}
.vos-zoom-transcript-empty {
  color: rgba(255,255,255,.68); font-size: 12px;
  align-self: center; margin: auto;
}

/* Control bar */
.vos-zoom-bar {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 14px 24px;
  background: rgba(0,0,0,.7);
  border-top: 1px solid rgba(255,255,255,.06);
}
.vos-zoom-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-width: 64px; padding: 9px 12px;
  border: none; border-radius: 12px; cursor: pointer;
  background: rgba(255,255,255,.09); color: rgba(255,255,255,.85);
  font-size: 11px; font-weight: 600; letter-spacing: .02em;
  transition: background .15s ease, transform .15s ease;
}
.vos-zoom-btn:hover  { background: rgba(255,255,255,.15); transform: scale(1.05); }
.vos-zoom-btn:active { transform: scale(.95); }
.vos-zoom-btn:disabled { opacity: .35; cursor: not-allowed; transform: none !important; }
.vos-zoom-btn-icon { display: flex; align-items: center; justify-content: center; height: 24px; }
.vos-zoom-btn.active { background: rgba(16,185,129,.2);  color: #34d399; }
.vos-zoom-btn.muted  { background: rgba(239,68,68,.15);  color: #f87171; }
.vos-zoom-btn.danger { background: #dc2626; color: #fff; min-width: 80px; }
.vos-zoom-btn.danger:hover { background: #ef4444; }

/* Static persona image (when no video URL is available) */
.vos-persona-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vos-persona-img-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.15) 0%, transparent 35%, transparent 65%, rgba(0,0,0,.5) 100%);
}
.vos-presenter-shell {
  position: absolute;
  inset: 0;
  padding: 14px;
}

/* Body detection cue overlay on user PiP */
.vos-pip-cues {
  position: absolute; inset: 0; pointer-events: none;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 6px;
}
.vos-pip-cue-row { display: flex; gap: 4px; flex-wrap: wrap; }
.vos-pip-cue {
  font-size: 9px; font-weight: 700; letter-spacing: .03em;
  padding: 2px 6px; border-radius: 10px;
  background: rgba(0,0,0,.6); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,.12);
  color: rgba(255,255,255,.7);
}
.vos-pip-cue.green  { color: #4ade80; border-color: rgba(74,222,128,.3); }
.vos-pip-cue.yellow { color: #facc15; border-color: rgba(250,204,21,.3); }
.vos-pip-cue.red    { color: #f87171; border-color: rgba(248,113,113,.3); }
.vos-pip-cue.blue   { color: #60a5fa; border-color: rgba(96,165,250,.3); }
.vos-pip-cue.muted  { color: rgba(255,255,255,.35); border-color: rgba(255,255,255,.08); }
.vos-pip-cue-bottom { display: flex; align-items: flex-end; gap: 6px; }
.vos-pip-emotion { font-size: 15px; line-height: 1; }
.vos-pip-attention { flex: 1; }
.vos-pip-attention-label { font-size: 8px; color: rgba(255,255,255,.4); font-weight: 700; margin-bottom: 2px; }
.vos-pip-attention-track {
  height: 3px; border-radius: 2px; background: rgba(255,255,255,.1); overflow: hidden;
}
.vos-pip-attention-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #22c55e, #3b82f6);
  transition: width .8s ease;
}

`

// ── Status indicator ───────────────────────────────────────────────────────────

function StatusIcon({ state }: { state: 'speaking' | 'thinking' | 'listening' | 'idle' }) {
  if (state === 'speaking') {
    return (
      <div className="vos-bars">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="vos-bar" />
        ))}
      </div>
    )
  }
  if (state === 'thinking') {
    return (
      <div className="vos-dots">
        <div className="vos-dot" />
        <div className="vos-dot" />
        <div className="vos-dot" />
      </div>
    )
  }
  if (state === 'listening') {
    return (
      <div className="vos-mic-pulse">
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
          <rect width={8} height={13} x={8} y={2} fill="currentColor" rx={4} />
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={2.5}
            d="M5 11a7 7 0 1 0 14 0m-7 10v-2"
          />
        </svg>
      </div>
    )
  }
  return <div className="vos-idle-dot" />
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceOrbSession({
  messages,
  assistantSpeaking,
  isListening,
  isProcessing,
  isConnected,
  isConnecting = false,
  connectionError = null,
  sessionStatus,
  isSttSupported,
  isSttPermissionBlocked,
  interimTranscript,
  sttError,
  sttCommitRemainingMs,
  sttCommitProgress,
  textInput,
  onHangUp,
  onMicrophoneClick,
  onSendText,
  onTextInputChange,
  onScheduleIdleHints,
  onTurnHelp,
  analyserRef,
  audioElementRef,
  onPauseReplay,
  currentAudioUrl,
  resumePromptOpen,
  entryPromptMode,
  onResume,
  onStartOver,
  startOverLoading,
  mode = 'voice',
  cameraEnabled,
  onToggleCamera,
  userVideoRef,
  presenterTone,
  presenterIsFrustrated = false,
  visualState,
}: VoiceOrbSessionProps) {
  const isVideoMode = mode === 'video'
  const isTextMode = mode === 'text'
  const isAlwaysOpen = isTextMode || isVideoMode
  const isRetakePrompt = entryPromptMode === 'retake'
  const [isOpen, setIsOpen] = useState(false)
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null)
  const latestMessage = messages[messages.length - 1]
  const lastMessageId = messages[messages.length - 1]?.id ?? null
  const userClosedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const linesRef = useRef<HTMLDivElement>(null)
  const ringsRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const emptyAudioElementRef = useRef<HTMLAudioElement>(null)

  // ── Body cue helpers ────────────────────────────────────────────────────────
  const vs = visualState ?? null
  const postureLabel = (p: string) =>
    p === 'leaning_in'
      ? 'Leaning in'
      : p === 'leaning_back'
        ? 'Leaning back'
        : p === 'upright'
          ? 'Upright'
          : ''
  const postureColor = (p: string) =>
    p === 'leaning_in' ? 'green' : p === 'leaning_back' ? 'yellow' : p === 'upright' ? '' : 'muted'
  const gazeLabel = (g: string) =>
    g === 'camera'
      ? 'On camera'
      : g === 'left'
        ? 'Left'
        : g === 'right'
          ? 'Right'
          : g === 'down'
            ? 'Looking down'
            : ''
  const gazeColor = (g: string) => (g === 'camera' ? 'green' : g === 'unknown' ? 'muted' : 'yellow')
  const emotionEmoji = (e: string): string =>
    ({
      happy: '😊',
      sad: '😔',
      angry: '😠',
      frustrated: '😤',
      surprised: '😲',
      neutral: '😐',
      unknown: '',
    })[e] ?? ''

  // Auto-open on first messages — only if user hasn't explicitly closed (voice only)
  useEffect(() => {
    if (isAlwaysOpen) return
    if (messages.length > 0 && !userClosedRef.current) setIsOpen(true)
  }, [messages.length, isAlwaysOpen])

  // Track newest message for word animation
  useEffect(() => {
    if (lastMessageId) setLatestMsgId(lastMessageId)
  }, [lastMessageId])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, interimTranscript])

  // ── Audio-reactive morph speed + scale ────────────────────────────────────
  // analyserRef.current is read inside tick() — child effects run before parent
  // effects in React, so the AnalyserNode isn't connected yet at setup time.
  useEffect(() => {
    if (!assistantSpeaking) {
      cancelAnimationFrame(rafRef.current)
      if (linesRef.current) {
        // animationName = 'none' kills the animation and immediately shows
        // the element's base CSS state (border-radius: 50%) — no stuck frame.
        linesRef.current.style.animationName = 'none'
        linesRef.current.style.transform = ''
      }
      if (ringsRef.current) ringsRef.current.style.transform = ''
      return
    }

    let buf: Uint8Array<ArrayBuffer> | null = null
    let smooth = 0
    let wasActive = false // track transition to avoid resetting mid-animation

    const tick = () => {
      const analyser = analyserRef?.current

      if (analyser) {
        if (!buf || buf.length !== analyser.frequencyBinCount) {
          buf = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
        }
        analyser.getByteFrequencyData(buf)

        const lo = Math.floor(buf.length * 0.04)
        const hi = Math.floor(buf.length * 0.7)
        const range = hi - lo

        let sum = 0
        for (let i = lo; i < hi; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / range) / 255
        smooth += (rms > smooth ? 0.1 : 0.04) * (rms - smooth)
        const lvl = Math.min(smooth * 1.6, 1)

        if (linesRef.current) {
          if (lvl > 0.05) {
            if (!wasActive) {
              // Restore CSS animation from scratch so it starts at frame 0
              linesRef.current.style.animationName = ''
              linesRef.current.style.animationPlayState = 'running'
              wasActive = true
            }
            // 8s at low volume → 3.5s at peak
            linesRef.current.style.animationDuration = `${Math.max(3.5, 8 - lvl * 4.5).toFixed(2)}s`
            linesRef.current.style.transform = `translate(-50%, -50%) scale(${1 + lvl * 0.25})`
          } else {
            if (wasActive) {
              // Drop back to base circle cleanly
              linesRef.current.style.animationName = 'none'
              linesRef.current.style.transform = ''
              wasActive = false
            }
          }
        }
        if (ringsRef.current) {
          ringsRef.current.style.transform = lvl > 0.05 ? `scale(${1 + lvl * 0.15})` : ''
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [assistantSpeaking, analyserRef])

  // Cleanup on unmount
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
    },
    []
  )

  const handleCollapse = useCallback(() => {
    userClosedRef.current = true
    setIsOpen(false)
  }, [])

  const handleOrbClick = useCallback(() => {
    if (isOpen) {
      userClosedRef.current = true
      setIsOpen(false)
    } else {
      userClosedRef.current = false
      setIsOpen(true)
    }
  }, [isOpen])

  // ── Derived state ──────────────────────────────────────────────────────────

  const ballColor = isListening
    ? '#10b981'
    : assistantSpeaking
      ? '#3b82f6'
      : isProcessing
        ? '#8b5cf6'
        : '#ff0002'

  const statusState: 'speaking' | 'thinking' | 'listening' | 'idle' = assistantSpeaking
    ? 'speaking'
    : isProcessing
      ? 'thinking'
      : isListening
        ? 'listening'
        : 'idle'

  const isAwaitingUserTurn =
    sessionStatus !== 'ended' &&
    isConnected &&
    !assistantSpeaking &&
    !isProcessing &&
    latestMessage?.role === 'assistant'

  const statusLabel = assistantSpeaking
    ? isListening
      ? 'Interrupted'
      : 'AI Speaking'
    : isProcessing
      ? 'Thinking…'
      : isAwaitingUserTurn
        ? 'Your Turn'
        : sessionStatus === 'ended'
          ? entryPromptMode === 'retake'
            ? 'Session ended'
            : 'Ended'
          : isListening
            ? 'Your Turn'
            : isConnected
              ? 'Ready'
              : connectionError
                ? 'Connection error'
                : 'Connecting…'
  const presenterPlaybackMode = getPresenterPlaybackMode({
    assistantSpeaking,
    isListening,
    isProcessing,
    interimTranscript,
    sttCommitRemainingMs,
  })

  // In-panel status shows interrupt hint when AI is talking and user hasn't cut in yet
  const panelStatusLabel =
    assistantSpeaking && !isListening
      ? 'AI Speaking — tap mic to interrupt'
      : isAwaitingUserTurn
        ? isListening
          ? 'Your Turn — mic is on'
          : 'Your Turn — enabling mic…'
        : statusLabel
  const showTurnCommitTimer = isAwaitingUserTurn && isListening && sttCommitRemainingMs > 0
  const turnCommitProgress = Math.max(0, Math.min(1, sttCommitProgress))

  const canSend = !!textInput.trim() && isConnected && sessionStatus !== 'ended'
  const promptHeading = isRetakePrompt ? 'Start a new attempt?' : 'Resume where you left off?'
  const promptDescription = isRetakePrompt
    ? 'This session has ended. Start a new iteration on the same session and continue tracking attempts separately.'
    : 'This session already has progress. You can continue the existing attempt or start a new iteration on the same session.'

  return (
    <div
      className={`container-vao${isAlwaysOpen || isOpen ? ' vos-open' : ''}${isListening ? ' vos-listening' : ''}${isTextMode ? ' vos-text-mode' : ''}`}
      style={{ '--vos-ball-color': ballColor } as React.CSSProperties}
    >
      <style>{CSS}</style>

      {resumePromptOpen && (
        <div className="vos-prompt-modal">
          <div className="vos-prompt-modal-backdrop" />
          <div className="vos-prompt-modal-card" role="dialog" aria-modal="true">
            <p className="vos-bubble-heading">{promptHeading}</p>
            <p className="vos-bubble-desc">{promptDescription}</p>
            <div className="vos-bubble-actions">
              {!isRetakePrompt && (
                <button
                  className="vos-bubble-btn vos-bubble-btn-secondary"
                  onClick={onStartOver}
                  disabled={startOverLoading}
                >
                  {startOverLoading ? 'Starting…' : 'New Iteration'}
                </button>
              )}
              <button
                className="vos-bubble-btn vos-bubble-btn-primary"
                onClick={isRetakePrompt ? onStartOver : onResume}
                disabled={startOverLoading}
              >
                {isRetakePrompt
                  ? startOverLoading
                    ? 'Starting…'
                    : 'Start New Attempt'
                  : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isVideoMode ? (
        /* ── Zoom-like video layout ── */
        <div className="vos-zoom-layout">
          {/* Video area (top, flex:1) */}
          <div className="vos-zoom-video-area">
            <div className="vos-presenter-shell">
              <PabloPresenter
                playbackMode={presenterPlaybackMode}
                audioElementRef={audioElementRef ?? emptyAudioElementRef}
                presenterTone={presenterTone}
                presenterIsFrustrated={presenterIsFrustrated}
              />
            </div>

            {/* Status pill */}
            <div className={`vos-zoom-status status-${statusState}`}>
              <StatusIcon state={statusState} />
              <span>{statusLabel}</span>
            </div>

            {/* User camera PiP */}
            <div className="vos-zoom-pip">
              {cameraEnabled ? (
                <video
                  ref={userVideoRef as React.RefObject<HTMLVideoElement>}
                  autoPlay
                  playsInline
                  muted
                />
              ) : (
                <div className="vos-zoom-pip-off">
                  <IconVideoOff size={22} />
                  <span>Camera off</span>
                </div>
              )}

              {/* Body detection cue overlay — only shown when camera is on and person detected */}
              {cameraEnabled && vs?.present && (
                <div className="vos-pip-cues">
                  <div className="vos-pip-cue-row">
                    {postureLabel(vs.posture) && (
                      <span className={`vos-pip-cue ${postureColor(vs.posture)}`}>
                        {postureLabel(vs.posture)}
                      </span>
                    )}
                    {gazeLabel(vs.gaze) && (
                      <span className={`vos-pip-cue ${gazeColor(vs.gaze)}`}>
                        {gazeLabel(vs.gaze)}
                      </span>
                    )}
                    {vs.headMotion !== 'still' && (
                      <span className="vos-pip-cue blue">
                        {vs.headMotion === 'nodding' ? '↕ Nodding' : '↔ Shaking'}
                      </span>
                    )}
                  </div>

                  <div className="vos-pip-cue-bottom">
                    {emotionEmoji(vs.emotion) && (
                      <span className="vos-pip-emotion" title={vs.emotion}>
                        {emotionEmoji(vs.emotion)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transcript (middle) */}
          <div className="vos-zoom-transcript" ref={scrollRef}>
            {messages.length === 0 && !interimTranscript ? (
              <span className="vos-zoom-transcript-empty">Conversation will appear here…</span>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user'
                const isNew = msg.id === latestMsgId
                const words = msg.text.split(/\s+/).filter(Boolean)
                return (
                  <div
                    key={msg.id}
                    className={isUser ? 'chat-user' : 'chat-ia'}
                    style={{ '--delay': isNew ? 0 : -1000 } as React.CSSProperties}
                  >
                    <p>
                      {words.map((word, wi) => (
                        <span
                          key={wi}
                          style={{ '--word': isNew ? wi + 1 : -1000 } as React.CSSProperties}
                        >
                          {word}
                        </span>
                      ))}
                    </p>
                    {!isUser && onTurnHelp && (
                      <button
                        className="vos-turn-help-btn"
                        type="button"
                        onClick={() => onTurnHelp(msg)}
                        title="Ask coach for a suggested response"
                      >
                        Ask Coach
                      </button>
                    )}
                  </div>
                )
              })
            )}
            {interimTranscript && (
              <div className="chat-user" style={{ '--delay': -1000 } as React.CSSProperties}>
                <p style={{ opacity: 0.4, fontStyle: 'italic' }}>
                  <span style={{ '--word': -1000 } as React.CSSProperties}>
                    {interimTranscript}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Zoom control bar (bottom) */}
          <div className="vos-zoom-bar">
            <button
              className={`vos-zoom-btn${cameraEnabled ? ' active' : ' muted'}`}
              onClick={onToggleCamera}
              title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <div className="vos-zoom-btn-icon">
                {cameraEnabled ? <IconVideo size={20} /> : <IconVideoOff size={20} />}
              </div>
              Camera
            </button>

            <button
              className={`vos-zoom-btn${isListening ? ' active' : ''}`}
              onClick={onMicrophoneClick}
              disabled={!isSttSupported || !isConnected || sessionStatus === 'ended'}
              title={isListening ? 'Mute mic' : 'Unmute mic'}
            >
              <div className="vos-zoom-btn-icon">
                {isListening ? <IconMicrophone size={20} /> : <IconMicrophoneOff size={20} />}
              </div>
              {isListening ? 'Mute' : 'Unmute'}
            </button>

            <button className="vos-zoom-btn danger" onClick={onHangUp} title="Leave session">
              <div className="vos-zoom-btn-icon">
                <IconPhoneOff size={20} />
              </div>
              Leave
            </button>

            <button
              className={`vos-zoom-btn${assistantSpeaking ? ' active' : ''}`}
              onClick={onPauseReplay}
              disabled={!onPauseReplay || (!assistantSpeaking && !currentAudioUrl)}
              title={assistantSpeaking ? 'Stop audio' : 'Replay last response'}
            >
              <div className="vos-zoom-btn-icon">
                {assistantSpeaking ? <IconPlayerStop size={20} /> : <IconPlayerPlay size={20} />}
              </div>
              {assistantSpeaking ? 'Stop' : 'Replay'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Voice / Text layout ── */
        <>
          {/* ── Orb ── always a mic toggle ── */}
          <div
            className="orb"
            role="button"
            tabIndex={0}
            onClick={handleOrbClick}
            onKeyDown={(e) => e.key === 'Enter' && handleOrbClick()}
            aria-label={isOpen ? 'Collapse panel' : 'Open panel'}
            title={isOpen ? 'Collapse panel' : 'Open panel'}
          >
            <div className="icons">
              <svg
                className="svg"
                xmlns="http://www.w3.org/2000/svg"
                width={24}
                height={24}
                viewBox="0 0 24 24"
              >
                <g fill="none">
                  <rect width={8} height={13} x={8} y={2} fill="currentColor" rx={4} />
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 11a7 7 0 1 0 14 0m-7 10v-2"
                  />
                </g>
              </svg>
            </div>

            <div className="ball">
              <div className="container-lines" ref={linesRef} />
              <div className="container-rings" ref={ringsRef} />
            </div>

            {/* Status label — visible below orb only when panel is closed */}
            <div className={`vos-orb-label status-${statusState}`}>{statusLabel}</div>

            <svg
              style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
              aria-hidden="true"
            >
              <defs>
                <filter id="vos-gooey">
                  <feGaussianBlur in="SourceGraphic" stdDeviation={6} />
                  <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" />
                </filter>
              </defs>
            </svg>
          </div>

          {/* ── Chat panel ── */}
          <div className="container-chat-ia">
            {/* Title row */}
            <div className="container-title">
              {/* Status bar */}
              <div
                className={`vos-status-bar status-${statusState}${showTurnCommitTimer ? ' vos-turn-timer' : ''}`}
                style={
                  showTurnCommitTimer
                    ? ({ '--vos-turn-progress': turnCommitProgress } as React.CSSProperties)
                    : undefined
                }
              >
                <StatusIcon state={statusState} />
                <span>{panelStatusLabel}</span>
              </div>

              <button
                className="vos-collapse-btn"
                onClick={handleCollapse}
                title="Collapse panel — mic stays active"
                aria-label="Collapse panel"
              >
                <IconChevronCompactDown size={20} />
              </button>
            </div>

            {/* Chat body */}
            <div className="container-chat">
              <div className="container-chat-limit" ref={scrollRef}>
                <div className="chats">
                  {messages.length === 0 && (
                    <div className="chat-ia" style={{ '--delay': -1000 } as React.CSSProperties}>
                      <p>
                        <span style={{ '--word': -1000 } as React.CSSProperties}>
                          Conversation will appear here…
                        </span>
                      </p>
                    </div>
                  )}

                  {messages.map((msg) => {
                    const isUser = msg.role === 'user'
                    const isNew = msg.id === latestMsgId
                    const words = msg.text.split(/\s+/).filter(Boolean)
                    return (
                      <div
                        key={msg.id}
                        className={isUser ? 'chat-user' : 'chat-ia'}
                        style={{ '--delay': isNew ? 0 : -1000 } as React.CSSProperties}
                      >
                        <p>
                          {words.map((word, wi) => (
                            <span
                              key={wi}
                              style={{ '--word': isNew ? wi + 1 : -1000 } as React.CSSProperties}
                            >
                              {word}
                            </span>
                          ))}
                        </p>
                        {!isUser && onTurnHelp && (
                          <button
                            className="vos-turn-help-btn"
                            type="button"
                            onClick={() => onTurnHelp(msg)}
                            title="Ask coach for a suggested response"
                          >
                            Ask Coach
                          </button>
                        )}
                      </div>
                    )
                  })}

                  {interimTranscript && (
                    <div className="chat-user" style={{ '--delay': -1000 } as React.CSSProperties}>
                      <p style={{ opacity: 0.4, fontStyle: 'italic' }}>
                        <span style={{ '--word': -1000 } as React.CSSProperties}>
                          {interimTranscript}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {sttError && isSttSupported && (
                <div
                  style={{
                    padding: '2px 14px',
                    fontSize: 11,
                    color: '#e53e3e',
                    flexShrink: 0,
                    zIndex: 2,
                  }}
                >
                  STT: {sttError}
                </div>
              )}

              {/* Controls row */}
              <div className="vos-controls">
                <button
                  className={`vos-btn vos-btn-replay${assistantSpeaking ? ' active' : ''}`}
                  onClick={onPauseReplay}
                  disabled={!onPauseReplay || (!assistantSpeaking && !currentAudioUrl)}
                  title={assistantSpeaking ? 'Stop audio' : 'Replay last response'}
                  aria-label={assistantSpeaking ? 'Stop audio' : 'Replay last response'}
                >
                  {assistantSpeaking ? <IconPlayerStop size={18} /> : <IconPlayerPlay size={18} />}
                </button>

                <button
                  className="vos-btn vos-btn-hangup"
                  onClick={onHangUp}
                  title="End call"
                  aria-label="End call"
                >
                  <IconPhone size={22} />
                </button>

                <button
                  className={`vos-btn vos-btn-mic${isListening ? ' listening' : assistantSpeaking ? ' can-interrupt' : ''}`}
                  onClick={onMicrophoneClick}
                  disabled={!isSttSupported || !isConnected || sessionStatus === 'ended'}
                  title={
                    sessionStatus === 'ended'
                      ? 'Session ended'
                      : !isSttSupported
                        ? 'Speech recognition unsupported'
                        : isSttPermissionBlocked
                          ? 'Microphone access blocked'
                          : isListening
                            ? 'Stop listening'
                            : assistantSpeaking
                              ? 'Tap to interrupt'
                              : 'Start listening'
                  }
                  aria-label={
                    isListening
                      ? 'Stop microphone'
                      : assistantSpeaking
                        ? 'Interrupt AI'
                        : 'Start microphone'
                  }
                >
                  <IconMicrophone size={18} />
                </button>
              </div>

              {/* Text input */}
              <div className="vos-input-row">
                <input
                  type="text"
                  className="vos-input"
                  placeholder={
                    !isConnected
                      ? sessionStatus === 'ended'
                        ? 'Session ended — start a new iteration'
                        : connectionError
                          ? 'Connection error — please refresh'
                          : 'Connecting…'
                      : sessionStatus === 'ended'
                        ? 'Session ended'
                        : 'Type a message…'
                  }
                  value={textInput}
                  onChange={(e) => {
                    onTextInputChange(e.target.value)
                    onScheduleIdleHints()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSend) onSendText()
                  }}
                  disabled={!isConnected || sessionStatus === 'ended'}
                />
                <button className="vos-send" onClick={onSendText} disabled={!canSend} title="Send">
                  ›
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
