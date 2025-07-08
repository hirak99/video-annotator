import React, { useState, useEffect, useRef } from 'react';
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

// Function to get from backend.
const getBackendPromise = async (endpoint: string) => {
    return axios.get(`${BACKEND_URL}${endpoint}`);
};

const VideoPlayer: React.FC = () => {
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);  // Track current video time (absolute)
    const [duration, setDuration] = useState<number>(0); // Total video duration
    const playerRef = useRef<HTMLVideoElement>(null);

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
    }, []);

    const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        setCurrentTime(event.currentTarget.currentTime);
    };

    const addBox = () => {
        const newBox = {
            id: Date.now().toString(),
            name: 'New Box',
            start: currentTime,
            end: currentTime + 10, // Assuming a default duration for a new box
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
            <video
                ref={playerRef}
                src={`${BACKEND_URL}/api/video`} // Use the new endpoint
                controls
                autoPlay
                onTimeUpdate={handleTimeUpdate}
                style={{ width: '100%', backgroundColor: 'black' }}
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
