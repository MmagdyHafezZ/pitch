interface PitchLogoProps {
  className?: string
}

export default function PitchLogo({ className = 'w-8 h-8' }: PitchLogoProps) {
  return (
    <div className={`${className} flex items-center justify-center`}>
      <div className="relative">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <rect width="32" height="32" rx="8" fill="url(#gradient)" />
          <path d="M8 12h16v2H8v-2zm0 4h16v2H8v-2zm0 4h12v2H8v-2z" fill="white" />
          <defs>
            <linearGradient
              id="gradient"
              x1="0"
              y1="0"
              x2="32"
              y2="32"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6366F1" />
              <stop offset="0.5" stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}
