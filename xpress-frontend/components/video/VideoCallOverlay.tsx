import { PointerEvent, RefObject, useRef, useState } from 'react';

interface VideoCallOverlayProps {
    localVideoRef: RefObject<HTMLVideoElement | null>;
    remoteVideoRef: RefObject<HTMLVideoElement | null>;
    timerText: string;
    muted: boolean;
    cameraOff: boolean;
    onToggleMute: () => void;
    onToggleCamera: () => void;
    onEndCall: () => void;
}

export default function VideoCallOverlay({
    localVideoRef,
    remoteVideoRef,
    timerText,
    muted,
    cameraOff,
    onToggleMute,
    onToggleCamera,
    onEndCall,
}: VideoCallOverlayProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
    const previewDragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        baseX: number;
        baseY: number;
    } | null>(null);

    const handlePreviewPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        previewDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            baseX: previewOffset.x,
            baseY: previewOffset.y,
        };
    };

    const handlePreviewPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const drag = previewDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const container = containerRef.current;
        const preview = previewRef.current;
        if (!container || !preview) return;

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        const nextX = drag.baseX + deltaX;
        const nextY = drag.baseY + deltaY;

        const containerRect = container.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();

        const baseRightPx = 24;
        const baseTopPx = 24;
        const baseLeft = containerRect.width - baseRightPx - previewRect.width;

        const minX = -baseLeft;
        const maxX = baseRightPx;
        const minY = -baseTopPx;
        const maxY = containerRect.height - previewRect.height - baseTopPx;

        const clampedX = Math.min(maxX, Math.max(minX, nextX));
        const clampedY = Math.min(maxY, Math.max(minY, nextY));

        setPreviewOffset({
            x: clampedX,
            y: clampedY,
        });
    };

    const handlePreviewPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        const drag = previewDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.currentTarget.releasePointerCapture(event.pointerId);
        previewDragRef.current = null;
    };

    return (
        <section className="fixed inset-0 z-50 bg-[#ececf5] p-3 md:p-6 animate-fade-in">
            <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-[18px] border border-[#8aa2d8] bg-[#edf0fa] p-4 animate-rise-up">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 z-0 h-full w-full object-cover scale-110"
                />

                <div className="relative z-20 flex items-center gap-3">
                    <div className="rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white">{timerText}</div>
                </div>

                <div
                    ref={previewRef}
                    className="absolute right-6 top-6 z-20 h-35 w-55 touch-none overflow-hidden rounded-2xl border border-white/30 bg-black/70 cursor-grab active:cursor-grabbing"
                    style={{
                        transform: `translate(${previewOffset.x}px, ${previewOffset.y}px)`,
                    }}
                    onPointerDown={handlePreviewPointerDown}
                    onPointerMove={handlePreviewPointerMove}
                    onPointerUp={handlePreviewPointerUp}
                    onPointerCancel={handlePreviewPointerUp}
                >
                    <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                </div>

                <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/88 px-5 py-3 shadow-xl backdrop-blur">
                    <button
                        type="button"
                        onClick={onToggleMute}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-700"
                    >
                        {muted ? (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m4 4 16 16" />
                                <path d="M12 4v7" />
                                <path d="M9 11a3 3 0 1 0 6 0" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="3" width="6" height="11" rx="3" />
                                <path d="M5 11a7 7 0 0 0 14 0" />
                                <path d="M12 18v3" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onToggleCamera}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-700"
                    >
                        {cameraOff ? (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m4 4 16 16" />
                                <rect x="3" y="6" width="13" height="12" rx="2" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="6" width="13" height="12" rx="2" />
                                <path d="m16 10 5-3v10l-5-3" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onEndCall}
                        className="inline-flex h-10 min-w-28 items-center justify-center rounded-full bg-[#c21d2f] px-4 text-sm font-semibold text-white"
                    >
                        End Call
                    </button>
                </div>
            </div>
        </section>
    );
}
