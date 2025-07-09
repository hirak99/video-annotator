import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SidebarItem from './SidebarItem';
import { Box } from './types';

// Backend URL.
const BACKEND_URL = 'http://localhost:5050'; // Should be in an env file for production

// Function to get from backend.
const getBackendPromise = async (endpoint: string) => {
    return axios.get(`${BACKEND_URL}${endpoint}`);
};

const VideoPlayer: React.FC = () => {
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);  // Track current video time (absolute)
    const playerRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        getBackendPromise('/api/labels').then(response => {
            setBoxes(response.data);  // Get labeled boxes data
        });
    }, []);

    const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        setCurrentTime(event.currentTarget.currentTime);
    };

    // Simple string hashing function to generate a number
    const stringToHash = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    };

    // Convert hash to HSL color string
    const hashToHSLColor = (hash: number): string => {
        const hue = hash % 360; // Hue is between 0 and 359
        const saturation = 70; // Keep saturation constant for vibrant colors
        const lightness = 50; // Keep lightness constant
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    const handleDeleteBox = (boxId: string) => {
        setBoxes(boxes.filter(box => box.id !== boxId));
        axios.delete(`${BACKEND_URL}/api/delete-label/${boxId}`); // Assuming a DELETE endpoint for deleting
    };

    const handleUpdateBox = (updatedBox: Box) => {
        setBoxes(boxes.map(box => box.id === updatedBox.id ? updatedBox : box));
        axios.put(`${BACKEND_URL}/api/update-label/${updatedBox.id}`, updatedBox); // Assuming a PUT endpoint for updating
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
        <div style={{ display: 'flex' }}> {/* Main container with flex display */}
            <div style={{ position: 'relative', width: '70%' }}> {/* Video/Box wrapper, taking 70% width */}
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
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}> {/* Box container */}
                    {boxes
                        .filter(box => currentTime >= box.start && currentTime <= box.end)
                        .map((box) => (
                            <div
                                key={box.id}
                                style={{
                                    position: 'absolute', // Positions relative to the box container
                                    top: box.y,
                                    left: box.x,
                                    width: box.width,
                                    height: box.height,
                                    border: `2px solid ${hashToHSLColor(stringToHash(box.name))}`,
                                    background: `${hashToHSLColor(stringToHash(box.name)).replace('hsl', 'hsla').replace(')', ', 0.3)')}`, // Add alpha for background
                                    pointerEvents: 'auto', // Allow pointer events on the individual boxes
                                }}
                                onClick={() => console.log('Editing box:', box.id)}  // Placeholder for box edit
                            >
                                {box.name}
                            </div>
                        ))}
                </div>
            </div> {/* End of video/box wrapper */}

            {/* Sidebar */}
            <div style={{ width: '30%', padding: '10px', borderLeft: '1px solid #ccc', overflowY: 'auto' }}> {/* Sidebar, taking 30% width */}
                <h3>Added ROIs</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}> {/* Flex grid for items */}
                    {boxes.sort((a, b) => a.start - b.start).map(box => (
                        <SidebarItem key={box.id} box={box} onUpdateBox={handleUpdateBox} onDeleteBox={handleDeleteBox} currentTime={currentTime} />
                    ))}
                </div>
                <button onClick={addBox} style={{ marginTop: '10px' }}>Add Box</button>
            </div> {/* End of sidebar */}

        </div>
    );
};

export default VideoPlayer;
