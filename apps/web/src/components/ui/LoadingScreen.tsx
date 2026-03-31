'use client'

import Image from 'next/image'
import { AppWordmark } from '@/components/ui/AppWordmark'

export function LoadingScreen() {
  return (
    <>
      <style>{`
        @keyframes pitchMascotFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes pitchGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes pitchDotBounce {
          0%, 80%, 100% { transform: translateY(0);  opacity: 0.25; }
          40%            { transform: translateY(-7px); opacity: 1; }
        }
        @keyframes pitchFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pitchTitleReveal {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pitch-loading-root {
          animation: pitchFadeIn 0.4s ease both;
        }
        .pitch-loading-mascot {
          animation: pitchMascotFloat 3s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .pitch-loading-glow {
          animation: pitchGlowPulse 3s ease-in-out infinite;
        }
        .pitch-loading-title {
          animation: pitchTitleReveal 0.6s 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pitch-loading-dot {
          animation: pitchDotBounce 1.5s ease-in-out infinite;
        }
        .pitch-loading-dot:nth-child(1) { animation-delay: 0s; }
        .pitch-loading-dot:nth-child(2) { animation-delay: 0.18s; }
        .pitch-loading-dot:nth-child(3) { animation-delay: 0.36s; }
      `}</style>

      <div
        className="pitch-loading-root"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          background: 'linear-gradient(160deg, #080e1e 0%, #0d1630 40%, #0a1225 70%, #060c1a 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Ambient grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
            pointerEvents: 'none',
          }}
        />

        {/* Glow orb */}
        <div
          className="pitch-loading-glow"
          style={{
            position: 'absolute',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(34,139,230,0.22) 0%, rgba(92,124,250,0.10) 50%, transparent 70%)',
            filter: 'blur(48px)',
            pointerEvents: 'none',
          }}
        />

        {/* Mascot */}
        <div className="pitch-loading-mascot" style={{ position: 'relative', zIndex: 1 }}>
          {/* Reflection / shadow under mascot */}
          <div
            style={{
              position: 'absolute',
              bottom: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 100,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(34,139,230,0.25)',
              filter: 'blur(14px)',
              pointerEvents: 'none',
            }}
          />
          <Image
            src="/pitchMascot.png"
            alt="PITCH"
            width={170}
            height={200}
            priority
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 24px 48px rgba(34,139,230,0.55))',
              display: 'block',
            }}
          />
        </div>

        {/* Branding */}
        <div
          className="pitch-loading-title"
          style={{
            marginTop: 40,
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          <AppWordmark subtitle="Preparing your workspace" />
        </div>

        {/* Bouncing dots */}
        <div
          style={{
            display: 'flex',
            gap: 9,
            marginTop: 32,
            zIndex: 1,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="pitch-loading-dot"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'rgba(34,139,230,0.9)',
                boxShadow: '0 0 8px rgba(34,139,230,0.6)',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
