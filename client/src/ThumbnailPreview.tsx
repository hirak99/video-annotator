import React from 'react';

const THUMBNAIL_WIDTH = 160; // Must match server
const THUMBNAIL_HEIGHT = 90; // Must match server
const SPRITE_COLS = 10; // Must match montage -tile 10x
const THUMBNAIL_SECS = 10; // Must match server

interface ThumbnailPreviewProps {
    thumbSpriteUrl: string;
    playerRef: React.RefObject<HTMLVideoElement>;
    previewTime: number;
    thumbX: number;
}

const ThumbnailPreview: React.FC<ThumbnailPreviewProps> = ({
    thumbSpriteUrl,
    playerRef,
    previewTime,
    thumbX,
}) => {
    if (
        !thumbSpriteUrl ||
        !playerRef.current ||
        playerRef.current.duration <= 0
    ) {
        return null;
    }

    // Format time in [h:]mm:ss
    const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const mm = m < 10 ? `0${m}` : m;
        const ss = s < 10 ? `0${s}` : s;
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    };

    // Thumbnail sprite logic
    const idx = Math.floor(previewTime / THUMBNAIL_SECS);
    const col = idx % SPRITE_COLS;
    const row = Math.floor(idx / SPRITE_COLS);

    const durationForThumbs = playerRef.current.duration;
    const totalThumbs = Math.ceil(durationForThumbs / THUMBNAIL_SECS);
    const rows = Math.ceil(totalThumbs / SPRITE_COLS);

    return (
        <div
            style={{
                position: 'absolute',
                left: thumbX,
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
                backgroundPosition: `-${col * THUMBNAIL_WIDTH}px -${row * THUMBNAIL_HEIGHT}px`,
                backgroundSize: `${SPRITE_COLS * THUMBNAIL_WIDTH}px ${rows * THUMBNAIL_HEIGHT}px`,
                transition: 'left 0.05s linear',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    color: 'white',
                    textShadow: '1px 1px 2px black',
                    fontSize: 12,
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {formatTime(previewTime)}
            </div>
        </div>
    );
};

export default ThumbnailPreview;
