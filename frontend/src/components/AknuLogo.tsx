import React, { useState } from 'react';
import aknuLogoImg from '../assets/aknu-logo.png';

interface AknuLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  useSvg?: boolean;
}

export const AknuLogo: React.FC<AknuLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  useSvg = false
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    sm: { box: 36, px: 'w-9 h-9' },
    md: { box: 48, px: 'w-12 h-12' },
    lg: { box: 64, px: 'w-16 h-16' },
    xl: { box: 80, px: 'w-20 h-20' }
  };

  const { box, px } = sizeMap[size];

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {!useSvg && !imgError ? (
        <img
          src={aknuLogoImg}
          alt="Adikavi Nannaya University Seal"
          width={box}
          height={box}
          onError={() => setImgError(true)}
          className={`${px} object-contain flex-shrink-0 drop-shadow-md rounded-full bg-white/10 p-0.5`}
        />
      ) : (
        <svg
          width={box}
          height={box}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${px} flex-shrink-0 drop-shadow-md`}
        >
          {/* Outer Circular Seal Frame */}
          <circle cx="50" cy="50" r="48" fill="#192B47" stroke="#D4AF37" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="44" fill="#23395D" stroke="#92582F" strokeWidth="1" strokeDasharray="3 2" />

        {/* Heraldic Rays / Sunburst background */}
        <g opacity="0.25">
          <path d="M50 8 L50 20 M50 80 L50 92 M8 50 L20 50 M80 50 L92 50" stroke="#D4AF37" strokeWidth="1.5" />
          <path d="M20 20 L28 28 M72 72 L80 80 M20 80 L28 72 M72 28 L80 20" stroke="#D4AF37" strokeWidth="1.5" />
        </g>

        {/* Center Shield */}
        <path
          d="M50 20 C64 20 74 24 74 36 C74 54 50 68 50 68 C50 68 26 54 26 36 C26 24 36 20 50 20 Z"
          fill="#92582F"
          stroke="#D4AF37"
          strokeWidth="1.5"
        />

        {/* Inner Shield Accent */}
        <path
          d="M50 23 C61 23 69 26 69 36 C69 50 50 62 50 62 C50 62 31 50 31 36 C31 26 39 23 50 23 Z"
          fill="#754522"
        />

        {/* Open Book of Knowledge (Honoring Adikavi Nannaya - Literature & Wisdom) */}
        <path
          d="M50 48 C44 44 38 45 34 47 L34 37 C38 35 44 34 50 38 C56 34 62 35 66 37 L66 47 C62 45 56 44 50 48 Z"
          fill="#FFFFFF"
          stroke="#192B47"
          strokeWidth="1"
        />
        <line x1="50" y1="38" x2="50" y2="48" stroke="#92582F" strokeWidth="1.2" />

        {/* Flaming Torch of Education (Jnana Deepam) */}
        <path
          d="M50 26 C47 29 48 32 50 35 C52 32 53 29 50 26 Z"
          fill="#F59E0B"
        />
        <circle cx="50" cy="30" r="1.5" fill="#EF4444" />

        {/* Laurel Wreath Branches */}
        <path
          d="M22 42 C18 52 24 68 34 74"
          stroke="#D4AF37"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M78 42 C82 52 76 68 66 74"
          stroke="#D4AF37"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Base Banner Ribbon */}
        <path
          d="M26 76 L36 74 L50 78 L64 74 L74 76 L70 82 L50 85 L30 82 Z"
          fill="#D4AF37"
          stroke="#92582F"
          strokeWidth="1"
        />
        <text
          x="50"
          y="81.5"
          fill="#192B47"
          fontSize="4.5"
          fontWeight="900"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.8"
        >
          AKNU • 2006
        </text>
      </svg>
      )}

      {showText && (
        <div>
          <h2 className="font-extrabold text-base tracking-wide text-white leading-tight uppercase">
            Adikavi Nannaya University
          </h2>
          <p className="text-[11px] font-semibold text-[#E0AD83] tracking-wider uppercase">
            Hostel Management System
          </p>
        </div>
      )}
    </div>
  );
};
