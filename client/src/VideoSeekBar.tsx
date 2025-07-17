import React, { useState, useRef } from 'react';

interface VideoSeekBarProps {
    duration: number; // total duration of the video in seconds
    currentTime: number; // current playback time in seconds
    onSeek: (time: number) => void; // callback when user seeks to a new time
    width: number; // optional width of the seek bar in pixels
    thumbSpriteUrl: string;
}

const VideoSeekBar: React.FC<VideoSeekBarProps> = ({
    duration,
    currentTime,
    onSeek,
    width,
    thumbSpriteUrl,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    // If set, will use this as position instead of the current time.
    const [dragTime, setDragTime] = useState<number | null>(null);
    const barRef = useRef<HTMLDivElement>(null);

    const height = 6;

    // Calculate the position of the thumb based on currentTime or dragTime
    const position = (() => {
        // Use dragTime if set, otherwise currentTime
        const time = dragTime !== null ? dragTime : currentTime;
        return Math.min(Math.max(0, time / duration), 1) * width;
    })();

    // Handle mouse events for dragging
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!barRef.current) return;
        setIsDragging(true);
        barRef.current.setPointerCapture(e.pointerId);
        updateDragTime(e.clientX);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !barRef.current) return;
        updateDragTime(e.clientX);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !barRef.current) return;
        updateDragTime(e.clientX);
        setIsDragging(false);
        barRef.current.releasePointerCapture(e.pointerId);
        if (dragTime !== null) {
            onSeek(dragTime);
        }
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

    return (
        <div
            ref={barRef}
            style={{
                position: 'relative',
                width: width,
                height: height,
                backgroundColor: '#444',
                borderRadius: height / 2,
                cursor: 'pointer',
                userSelect: 'none',
                margin: '4px 0',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleClick}
        >
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
