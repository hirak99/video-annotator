import React, { useState, useRef } from 'react';
import ThumbnailPreview from './ThumbnailPreview';

const THUMBNAIL_WIDTH = 160;

interface VideoSeekBarProps {
    duration: number; // total duration of the video in seconds
    currentTime: number; // current playback time in seconds
    onSeek: (time: number) => void; // callback when user seeks to a new time
    width: number; // width of the seek bar in pixels
    thumbSpriteUrl: string;
    thumbIntervalSecs: number | null;
    playerRef: React.RefObject<HTMLVideoElement | null>;
    onSeekEnd?: () => void; // called by parent after seek is complete
}

const VideoSeekBar: React.FC<VideoSeekBarProps> = ({
    duration,
    currentTime,
    onSeek,
    width,
    thumbSpriteUrl,
    thumbIntervalSecs,
    playerRef,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    // If set, will use this as position instead of the current time.
    const [dragTime, setDragTime] = useState<number | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const barRef = useRef<HTMLDivElement>(null);
    // Track if a seek is pending from the seekbar
    const pendingSeek = useRef(false);

    const height = 8;

    // Calculate the position of the thumb based on currentTime or dragTime
    const position = (() => {
        // Use dragTime if set, otherwise currentTime
        const time = dragTime !== null ? dragTime : currentTime;
        return Math.min(Math.max(0, time / duration), 1) * width;
    })();

    // Handle mouse events for dragging and hover
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!barRef.current) return;
        setIsDragging(true);
        barRef.current.setPointerCapture(e.pointerId);
        updateDragTime(e.clientX);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!barRef.current) return;
        if (isDragging) {
            updateDragTime(e.clientX);
        } else {
            updateHover(e.clientX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !barRef.current) return;
        updateDragTime(e.clientX);
        setIsDragging(false);
        barRef.current.releasePointerCapture(e.pointerId);
        if (dragTime !== null) {
            pendingSeek.current = true;
            onSeek(dragTime);
        }
        // Do NOT setDragTime(null) here; will reset after seeked event
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsHovering(true);
        if (barRef.current) {
            updateHover(e.clientX);
        }
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        setHoverX(null);
        setHoverTime(null);
    };

    const updateDragTime = (clientX: number) => {
        if (!barRef.current) return;
        const rect = barRef.current.getBoundingClientRect();
        const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
        const time = (x / rect.width) * duration;
        setDragTime(time);
    };

    // Handle click on the bar to seek immediately
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!barRef.current) return;
        const rect = barRef.current.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const time = (x / rect.width) * duration;
        onSeek(time);
    };

    // Update hover state
    const updateHover = (clientX: number) => {
        if (!barRef.current) return;
        const rect = barRef.current.getBoundingClientRect();
        const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
        const time = (x / rect.width) * duration;
        setHoverX(x);
        setHoverTime(time);
    };

    // Listen for seeked event on the video element to reset dragTime after seek is complete
    React.useEffect(() => {
        const video = playerRef?.current;
        if (!video) return;
        const handleSeeked = () => {
            if (pendingSeek.current) {
                setDragTime(null);
                pendingSeek.current = false;
            }
        };
        video.addEventListener('seeked', handleSeeked);
        return () => {
            video.removeEventListener('seeked', handleSeeked);
        };
    }, [playerRef]);

    return (
        <div
            ref={barRef}
            style={{
                position: 'relative',
                width: width,
                height: height,
                backgroundColor: '#ccc',
                borderRadius: height / 2,
                cursor: 'pointer',
                userSelect: 'none',
                margin: '4px 0',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Thumbnail preview (show on hover or drag) */}
            {(isHovering && hoverTime !== null && hoverX !== null) && (
                <ThumbnailPreview
                    thumbSpriteUrl={thumbSpriteUrl}
                    thumbIntervalSecs={thumbIntervalSecs}
                    playerRef={playerRef as React.RefObject<HTMLVideoElement>}
                    previewTime={hoverTime}
                    thumbX={Math.max(
                        0,
                        Math.min(
                            hoverX - THUMBNAIL_WIDTH / 2,
                            width - THUMBNAIL_WIDTH
                        )
                    )}
                />
            )}
            {isDragging && dragTime !== null && (
                <ThumbnailPreview
                    thumbSpriteUrl={thumbSpriteUrl}
                    thumbIntervalSecs={thumbIntervalSecs}
                    playerRef={playerRef as React.RefObject<HTMLVideoElement>}
                    previewTime={dragTime}
                    thumbX={Math.max(
                        0,
                        Math.min(
                            (dragTime / duration) * width - THUMBNAIL_WIDTH / 2,
                            width - THUMBNAIL_WIDTH
                        )
                    )}
                />
            )}
            {/* Progress bar fill */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: position,
                    backgroundColor: '#f39621',
                    borderRadius: height / 2,
                    pointerEvents: 'none',
                    transition: isDragging ? 'none' : 'width 0.1s linear',
                }}
            />
            {/* Thumb */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: position,
                    transform: 'translate(-50%, -50%)',
                    width: height * 2,
                    height: height * 2,
                    backgroundColor: '#f39621',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    boxShadow: '0 0 4px rgba(33, 150, 243, 0.7)',
                    transition: isDragging ? 'none' : 'left 0.1s linear',
                }}
            />
        </div>
    );
};

export default VideoSeekBar;
