import React, { useState } from 'react';

const THUMBNAIL_WIDTH = 160; // Must match server
const THUMBNAIL_HEIGHT = 90; // Must match server
const SPRITE_COLS = 10; // Must match montage -tile 10x
const THUMBNAIL_SECS = 10; // Must match server

interface ThumbnailPreviewProps {
    thumbSpriteUrl: string;
    playerRef: React.RefObject<HTMLVideoElement>;
    videoDimensions: { displayWidth: number; displayHeight: number };
}

const ThumbnailPreview: React.FC<ThumbnailPreviewProps> = ({
    thumbSpriteUrl,
    playerRef,
    videoDimensions,
}) => {
    const [showThumbPreview, setShowThumbPreview] = useState(false);
    const [thumbPreviewX, setThumbPreviewX] = useState(0);
    const [thumbPreviewTime, setThumbPreviewTime] = useState(0);
    const [isSeekingBarActive, setIsSeekingBarActive] = useState(false);

    return (
        <>
            {thumbSpriteUrl && playerRef.current && playerRef.current.duration > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: '100%',
                        height: 36, // Height of the timeline bar area (adjust as needed)
                        cursor: 'pointer',
                        zIndex: 10,
                        background: 'transparent',
                    }}
                    onMouseDown={e => {
                        setIsSeekingBarActive(true);
                        // Also update preview immediately
                        const rect = (e.target as HTMLDivElement).getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        setThumbPreviewX(x);
                        const duration = playerRef.current!.duration;
                        const time = Math.max(0, Math.min(duration, (x / rect.width) * duration));
                        setThumbPreviewTime(time);
                        setShowThumbPreview(true);
                    }}
                    onMouseUp={() => {
                        setIsSeekingBarActive(false);
                        setShowThumbPreview(false);
                    }}
                    onMouseMove={e => {
                        if (!isSeekingBarActive) return;
                        const rect = (e.target as HTMLDivElement).getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        setThumbPreviewX(x);
                        // Calculate time from x
                        const duration = playerRef.current!.duration;
                        const time = Math.max(0, Math.min(duration, (x / rect.width) * duration));
                        setThumbPreviewTime(time);
                        setShowThumbPreview(true);
                    }}
                    onMouseLeave={() => {
                        setIsSeekingBarActive(false);
                        setShowThumbPreview(false);
                    }}
                >
                    {showThumbPreview && isSeekingBarActive && (
                        <div
                            style={{
                                position: 'absolute',
                                left: Math.max(0, Math.min(thumbPreviewX - THUMBNAIL_WIDTH / 2, videoDimensions.displayWidth - THUMBNAIL_WIDTH)),
                                bottom: 36, // Show above the timeline overlay
                                width: THUMBNAIL_WIDTH,
                                height: THUMBNAIL_HEIGHT,
                                backgroundImage: `url(${thumbSpriteUrl})`,
                                backgroundRepeat: 'no-repeat',
                                backgroundColor: '#222',
                                border: '1px solid #888',
                                borderRadius: 4,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                pointerEvents: 'none',
                                zIndex: 20,
                                // Calculate background position
                                backgroundPosition: (() => {
                                    const idx = Math.floor(thumbPreviewTime / THUMBNAIL_SECS);
                                    const col = idx % SPRITE_COLS;
                                    const row = Math.floor(idx / SPRITE_COLS);
                                    return `-${col * THUMBNAIL_WIDTH}px -${row * THUMBNAIL_HEIGHT}px`;
                                })(),
                                backgroundSize: (() => {
                                    // Calculate total columns and rows
                                    const duration = playerRef.current!.duration;
                                    const totalThumbs = Math.ceil(duration / THUMBNAIL_SECS);
                                    const rows = Math.ceil(totalThumbs / SPRITE_COLS);
                                    return `${SPRITE_COLS * THUMBNAIL_WIDTH}px ${rows * THUMBNAIL_HEIGHT}px`;
                                })(),
                            }}
                        />
                    )}
                </div>
            )}
        </>
    );
};

export default ThumbnailPreview;
