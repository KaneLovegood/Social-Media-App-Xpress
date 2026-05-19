"use client";

import dynamic from "next/dynamic";

const Antigravity = dynamic(() => import("@/components/Antigravity"), {
  ssr: false,
});

export function AuthAntigravityBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Antigravity
        count={500}
        magnetRadius={6}
        ringRadius={8}
        waveSpeed={0.7}
        waveAmplitude={1}
        particleSize={0.7}
        lerpSpeed={0.05}
        color="#ffffff"
        autoAnimate
        particleVariance={1}
        rotationSpeed={0.5}
        pulseSpeed={1.2}
        particleShape="sphere"
      />
    </div>
  );
}
