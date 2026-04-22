import { useEffect } from 'react';
import { IRemoteAudioTrack } from 'agora-rtc-sdk-ng';

interface AudioCallOverlayProps {
    peerName: string;
    timerText: string;
    statusLabel: string;
    isConnected: boolean;
    isIncomingRinging: boolean;
    canShowWave: boolean;
    muted: boolean;
    speakerBoost: boolean;
    onToggleMute: () => void;
    onSwitchToVideo: () => void;
    onToggleSpeaker: () => void;
    onEndCall: () => void;
    onAcceptIncoming: () => void;
    onDeclineIncoming: () => void;
    remoteAudioTrack: IRemoteAudioTrack | null;
}

export default function AudioCallOverlay({
    peerName,
    timerText,
    statusLabel,
    isConnected,
    isIncomingRinging,
    canShowWave,
    muted,
    speakerBoost,
    onToggleMute,
    onSwitchToVideo,
    onToggleSpeaker,
    onEndCall,
    onAcceptIncoming,
    onDeclineIncoming,
    remoteAudioTrack,
}: AudioCallOverlayProps) {
    useEffect(() => {
        if (remoteAudioTrack) {
            remoteAudioTrack.play();
        }
        return () => {
            remoteAudioTrack?.stop();
        };
    }, [remoteAudioTrack]);
    const controls = isIncomingRinging ? (
        <>
            <button
                type="button"
                onClick={onDeclineIncoming}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
            >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m4 4 16 16" />
                    <rect x="3" y="6" width="13" height="12" rx="2" />
                </svg>
            </button>
            <button
                type="button"
                onClick={onAcceptIncoming}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#eb2329] text-white shadow-[0_8px_18px_rgba(235,35,41,0.35)]"
            >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <path d="M4.8 3.5h4.1l1.5 4.4-2.4 1.7a14.7 14.7 0 0 0 6.3 6.3l1.7-2.4 4.4 1.5v4.1l-2.3 1.1a5.2 5.2 0 0 1-5 .2A20.9 20.9 0 0 1 3.2 9a5.2 5.2 0 0 1 .2-5l1.4-.5Z" />
                </svg>
            </button>
        </>
    ) : (
        <>
            <button
                type="button"
                onClick={onToggleMute}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
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
                onClick={onSwitchToVideo}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
            >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="6" width="13" height="12" rx="2" />
                    <path d="m16 10 5-3v10l-5-3" />
                </svg>
            </button>
            <button
                type="button"
                onClick={onEndCall}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#eb2329] text-white shadow-[0_8px_18px_rgba(235,35,41,0.35)]"
            >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <path d="M4.8 3.5h4.1l1.5 4.4-2.4 1.7a14.7 14.7 0 0 0 6.3 6.3l1.7-2.4 4.4 1.5v4.1l-2.3 1.1a5.2 5.2 0 0 1-5 .2A20.9 20.9 0 0 1 3.2 9a5.2 5.2 0 0 1 .2-5l1.4-.5Z" />
                </svg>
            </button>
            <button
                type="button"
                onClick={onToggleSpeaker}
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${speakerBoost ? 'bg-[#152b58] text-white' : 'bg-[#eef2f7] text-[#243356]'}`}
            >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 10v4h4l5 4V6l-5 4H3Z" />
                    <path d="M16 9a4 4 0 0 1 0 6" />
                    <path d="M18.5 6.5a7 7 0 0 1 0 11" />
                </svg>
            </button>
            <button
                type="button"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
            >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <circle cx="7" cy="7" r="1.5" />
                    <circle cx="12" cy="7" r="1.5" />
                    <circle cx="17" cy="7" r="1.5" />
                    <circle cx="7" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="17" cy="12" r="1.5" />
                    <circle cx="7" cy="17" r="1.5" />
                    <circle cx="12" cy="17" r="1.5" />
                    <circle cx="17" cy="17" r="1.5" />
                </svg>
            </button>
        </>
    );

    return (
        <section className="fixed inset-0 z-50 bg-[#e8ebf3] animate-fade-in">
            <div className="relative flex h-full w-full flex-col overflow-hidden px-5 pb-24 pt-4 md:items-center md:justify-center md:px-10 md:pb-6">
                <div className="flex justify-center text-[#0e1a36] md:absolute md:left-1/2 md:top-6 md:w-90 md:-translate-x-1/2">
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-[#0b1328] text-center w-full">
                        VOICE CALL
                    </p>
                </div>

                <div className="relative mt-8 flex flex-1 flex-col items-center justify-center md:mt-0 md:max-w-170">
                    <div className="relative flex h-50 w-50 items-center justify-center md:h-60 md:w-60">
                        <span className={`absolute inset-0 rounded-full border border-[#d4dae6] ${canShowWave ? 'animate-call-wave' : ''}`} />
                        <span className={`absolute inset-6 rounded-full border border-[#d4dae6] ${canShowWave ? 'animate-call-wave [animation-delay:140ms]' : ''}`} />
                        <span className={`absolute inset-12 rounded-full border border-[#d4dae6] ${canShowWave ? 'animate-call-wave [animation-delay:280ms]' : ''}`} />
                        <div className="relative z-10 flex h-32 w-32 items-center justify-center rounded-full border-4 border-[#132d61] bg-[radial-gradient(circle_at_30%_20%,#29496f,#0c1325_70%)] text-4xl font-bold text-white shadow-[0_12px_28px_rgba(9,18,40,0.3)] md:h-36 md:w-36 md:text-4xl">
                            {peerName.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#80ddcf] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#045e57]">
                        <span className="h-2 w-2 rounded-full bg-[#0f6f68]" />
                        {statusLabel}
                    </div>

                    <h3 className="mt-3 text-5xl font-semibold text-[#091d49] md:text-5xl">{peerName}</h3>
                    <p className="mt-1 text-3xl font-semibold tracking-wide text-[#8f9fbe] md:text-3xl">{timerText}</p>

                    <div className="mt-6 hidden md:flex md:w-155 md:items-end md:justify-between">
                        {isConnected ? (
                            <div className="space-y-3">
                                <div className="rounded-2xl border-l-4 border-[#1b2644] bg-white/55 px-4 py-3 shadow-sm backdrop-blur">
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#72809a]">Network Stability</p>
                                    <div className="mt-2 flex items-end gap-1.5 text-[#1f2a4b]">
                                        <span className="h-3 w-1.5 rounded-full bg-current" />
                                        <span className="h-4.5 w-1.5 rounded-full bg-current" />
                                        <span className="h-6 w-1.5 rounded-full bg-current" />
                                        <span className="h-4 w-1.5 rounded-full bg-current/40" />
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white/55 px-4 py-3 shadow-sm backdrop-blur">
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#72809a]">Encrypted</p>
                                    <p className="mt-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0f274f] text-xs text-white">✓</p>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {isConnected ? (
                        <div className="mt-4 w-full max-w-115 rounded-3xl bg-white/72 px-4 py-3 shadow-[0_20px_34px_rgba(23,31,55,0.1)] backdrop-blur md:hidden">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#152b58] text-white">
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="3" width="6" height="11" rx="3" />
                                            <path d="M5 11a7 7 0 0 0 14 0" />
                                            <path d="M12 18v3" />
                                        </svg>
                                    </span>
                                    <div className="text-left text-[#0f1c3c]">
                                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#6f7e9e]">Audio Source</p>
                                        <p className="text-xl font-semibold">System HD Audio</p>
                                    </div>
                                </div>
                                <div className="flex items-end gap-1 text-[#0f1d44]">
                                    <span className="h-4 w-2 rounded-full bg-current/35" />
                                    <span className="h-7 w-2 rounded-full bg-current/55" />
                                    <span className="h-9 w-2 rounded-full bg-current" />
                                    <span className="h-6 w-2 rounded-full bg-current/50" />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-8 hidden w-full max-w-140 rounded-4xl bg-white/74 px-4 py-3 shadow-[0_24px_40px_rgba(18,27,51,0.12)] backdrop-blur md:block">
                        <div className="flex items-center justify-center gap-3 md:gap-4">
                            {controls}
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-6 left-1/2 w-[calc(100%-28px)] max-w-140 -translate-x-1/2 rounded-4xl bg-white/74 px-4 py-3 shadow-[0_24px_40px_rgba(18,27,51,0.12)] backdrop-blur md:hidden">
                    <div className="flex items-center justify-center gap-3">{controls}</div>
                </div>

                <div className="pointer-events-none absolute inset-0 hidden md:block">
                    <div className="absolute right-14 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full border border-[#d8deea]" />
                    <div className="absolute right-6 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full border border-[#d8deea]" />
                </div>
            </div>
        </section>
    );
}
