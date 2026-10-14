"use client";

import React from "react";

/**
 * Animated gradient background for the auth pages.
 *
 * Previously a full-screen 60fps SVG Lottie (lottie-react), which repaints a
 * large DOM subtree every frame on the MAIN thread and made typing/clicks on
 * the login form stutter. This is a pure-CSS gradient animation: the only
 * animated property is `background-position`, which the browser composites on
 * the GPU, so it never blocks input or React re-renders. No JS runs per frame,
 * and the ~64KB Lottie JSON + lottie-react are dropped from this route's bundle.
 *
 * Honors `prefers-reduced-motion`: the gradient still renders, it just stops
 * moving for users who opt out of motion.
 */
const LottieBackground: React.FC = () => {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden dark">
            <div className="auth-gradient absolute inset-0 opacity-60" />
            {/* Hardcoded dark overlay to prevent theme leakage */}
            <div className="absolute inset-0 bg-[#0a1120]/40 backdrop-blur-[2px]" />

            <style jsx>{`
                .auth-gradient {
                    background: linear-gradient(
                        130deg,
                        #0a1120,
                        #112033,
                        #1b2a4a,
                        #0e3a4f,
                        #112033,
                        #0a1120
                    );
                    background-size: 300% 300%;
                    animation: auth-gradient-shift 18s ease-in-out infinite;
                    will-change: background-position;
                }

                @keyframes auth-gradient-shift {
                    0% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0% 50%;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .auth-gradient {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default LottieBackground;
