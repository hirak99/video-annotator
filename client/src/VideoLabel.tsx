import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import axios from 'axios';

interface Box {
    id: string;
    name: string;
    start: number;
    end: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

// Backend URL.
const BACKEND_URL = 'http://localhost:5050'; // Should be in an env file for production
const CHUNK_DURATION = 10; // How many seconds of video to fetch at a time.

// Function to get from backend.
const getBackendPromise = async (endpoint: string) => {
    return axios.get(`${BACKEND_URL}${endpoint}`);
};

const VideoPlayer: React.FC = () => {
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);  // Track current video time (absolute)
    const [duration, setDuration] = useState<number>(0); // Total video duration
    const [chunkUrl, setChunkUrl] = useState<string>('');     // Video chunk URL
    const [chunkStartTime, setChunkStartTime] = useState<number>(0); // Start time of the current chunk
    const playerRef = useRef<ReactPlayer>(null);

    useEffect(() => {
        // On component mount, fetch video metadata and initial labels
        getBackendPromise('/api/video-info').then(response => {
            if (response.data.duration) {
                setDuration(response.data.duration);
            }
        });
        getBackendPromise('/api/labels').then(response => {
            setBoxes(response.data);  // Get labeled boxes data
        });

        // Load the first chunk of the video
        fetchVideoChunk(0, CHUNK_DURATION);
    }, []); // Empty dependency array ensures this runs only once.

    const fetchVideoChunk = (startTime: number, endTime: number) => {
        // Ensure we don't request beyond the video duration
        const realEndTime = duration > 0 ? Math.min(endTime, duration) : endTime;
        const newChunkUrl = `${BACKEND_URL}/api/video-chunk?start=${startTime}&end=${realEndTime}`;

        // Avoid reloading the same chunk
        if (newChunkUrl === chunkUrl) return;

        setChunkUrl(newChunkUrl);
        setChunkStartTime(startTime);
    };

    const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
        const absoluteTime = chunkStartTime + playedSeconds;
        setCurrentTime(absoluteTime);

        // Pre-fetch the next chunk when we are near the end of the current one for smooth playback
        if (duration > 0 && playedSeconds > CHUNK_DURATION - 2 && absoluteTime < duration) {
            fetchVideoChunk(absoluteTime, absoluteTime + CHUNK_DURATION);
        }
    };

    const handleVideoSeek = (time: number) => {
        // time is the absolute time in seconds from the seek bar
        setCurrentTime(time);
        fetchVideoChunk(time, time + CHUNK_DURATION);  // Request a chunk based on the seek time
    };

    const addBox = () => {
        const newBox = {
            id: Date.now().toString(),
            name: 'New Box',
            start: currentTime,
            end: currentTime + CHUNK_DURATION,
            x: 50,
            y: 50,
            width: 100,
            height: 100,
        };
        setBoxes([...boxes, newBox]);
        axios.post(`${BACKEND_URL}/api/add-label`, newBox);  // Save new label on the server
    };

    return (
        <div>
            {/* Video Player */}
            <ReactPlayer
                ref={playerRef}
                url={chunkUrl}
                controls
                playing
                duration={duration}
                onProgress={handleProgress}
                onSeek={handleVideoSeek}  // Handle manual seeking
            />

            {/* Label Boxes */}
            <div>
                {boxes
                    .filter(box => currentTime >= box.start && currentTime <= box.end)
                    .map((box) => (
                    <div
                        key={box.id}
                        style={{
                            position: 'absolute',
                            top: box.y,
                            left: box.x,
                            width: box.width,
                            height: box.height,
                            border: '2px solid red',
                            background: 'rgba(255, 0, 0, 0.3)',
                        }}
                        onClick={() => console.log('Editing box:', box.id)}  // Placeholder for box edit
                    >
                        {box.name}
                    </div>
                ))}
            </div>

            <button onClick={addBox}>Add Box</button>
        </div>
    );
};

export default VideoPlayer;
