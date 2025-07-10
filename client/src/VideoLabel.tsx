import React, { useState, useEffect, useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';
import axios from 'axios';
import SidebarItem from './SidebarItem';
import { Box } from './types';

// Backend URL.
const BACKEND_URL = 'http://localhost:5050'; // Should be in an env file for production

// Function to get from backend.
const getBackendPromise = async (endpoint: string, id?: number) => {
    return axios.get(`${BACKEND_URL}${endpoint}${id ? `/${id}` : ''}`);
};

const VideoPlayer: React.FC = () => {
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [currentVideoIdx, setCurrentVideoIdx] = useState<number>(0);
    const [videoFiles, setVideoFiles] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);  // Track current video time (absolute)
    const [videoDimensions, setVideoDimensions] = useState({
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0
    });
    const playerRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        getBackendPromise('/api/video-files').then(response => {
            const videoFiles = response.data;
            setVideoFiles(videoFiles); // Store video files
            if (videoFiles.length > 0) {
                setCurrentVideoIdx(0);
            }
        });
    }, []);

    useEffect(() => {
        getBackendPromise(`/api/labels/${currentVideoIdx}`).then(response => {
            setBoxes(response.data);  // Get labeled boxes data for the current video
        });
    }, [currentVideoIdx]);

    const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        setCurrentTime(event.currentTarget.currentTime);
    };

    const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        setVideoDimensions({
            naturalWidth: video.videoWidth,
            naturalHeight: video.videoHeight,
            displayWidth: video.clientWidth,
            displayHeight: video.clientHeight
        });
    };

    useEffect(() => {
        if (!playerRef.current) return;

        const observer = new ResizeObserver(() => {
            if (playerRef.current) {
                setVideoDimensions(prev => ({
                    ...prev,
                    displayWidth: playerRef.current!.clientWidth,
                    displayHeight: playerRef.current!.clientHeight
                }));
            }
        });

        observer.observe(playerRef.current);
        return () => observer.disconnect();
    }, []);

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
        axios.delete(`${BACKEND_URL}/api/delete-label/${currentVideoIdx}/${boxId}`); // Assuming a DELETE endpoint for deleting
    };

    const handleUpdateBox = (updatedBox: Box) => {
        setBoxes(boxes.map(box => box.id === updatedBox.id ? updatedBox : box));
        axios.put(`${BACKEND_URL}/api/update-label/${currentVideoIdx}/${updatedBox.id}`, updatedBox); // Assuming a PUT endpoint for updating
    };

    const addBox = () => {
        const newBox = {
            id: Date.now().toString(),
            name: '(Unnamed)',
            start: currentTime,
            end: currentTime + 10, // Assuming a default duration for a new box
            x: 50,
            y: 50,
            width: 100,
            height: 100,
        };
        setBoxes([...boxes, newBox]);
        axios.post(`${BACKEND_URL}/api/add-label/${currentVideoIdx}`, newBox);  // Save new label on the server
    };

    const isEventAtBottomRight = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        return event.clientX >= rect.right - 10 && event.clientY >= rect.bottom - 10;
    };


    return (
        <div style={{ display: 'flex' }}> {/* Main container with flex display */}
            <div style={{ position: 'relative', width: '70%' }}> {/* Video/Box wrapper, taking 70% width */}
                {/* List of videos */}
                <select onChange={(e) => setCurrentVideoIdx(Number(e.target.value))}>
                    {videoFiles.map((file, index) => (
                        <option key={index} value={index}>{file["video_file"]}</option>
                    ))}
                </select>

                {/* Video Player */}
                <video
                    ref={playerRef}
                    src={`${BACKEND_URL}/api/video/${currentVideoIdx}`}
                    controls
                    autoPlay
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleVideoLoad}
                    style={{ width: '100%', backgroundColor: 'black' }}
                />

                {/* Label Boxes */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}> {/* Box container */}
                    {boxes
                        .filter(box => currentTime >= box.start && currentTime <= box.end)
                        .map((box) => (

                            <div
                                key={box.id}
                                data-box-id={box.id}
                                style={{
                                    position: 'absolute', // Positions relative to the box container
                                    top: `${(box.y / videoDimensions.naturalHeight) * videoDimensions.displayHeight}px`,
                                    left: `${(box.x / videoDimensions.naturalWidth) * videoDimensions.displayWidth}px`,
                                    width: `${(box.width / videoDimensions.naturalWidth) * videoDimensions.displayWidth}px`,
                                    height: `${(box.height / videoDimensions.naturalHeight) * videoDimensions.displayHeight}px`,
                                    border: `2px solid ${hashToHSLColor(stringToHash(box.name))}`,
                                    background: `${hashToHSLColor(stringToHash(box.name)).replace('hsl', 'hsla').replace(')', ', 0.3)')}`, // Add alpha for background
                                    pointerEvents: 'auto', // Allow pointer events on the individual boxes
                                }}
                                onMouseDown={(event) => {
                                    event.stopPropagation();
                                    const boxRef = event.currentTarget;
                                    const boxId = boxRef.getAttribute('data-box-id');
                                    let box = boxes.find(b => b.id === boxId);
                                    if (box) {
                                        const startX = event.clientX;
                                        const startY = event.clientY;
                                        const initialX = box.x;
                                        const initialY = box.y;
                                        const initialWidth = box.width;
                                        const initialHeight = box.height;

                                        const scaleFactor = videoDimensions.naturalWidth / videoDimensions.displayWidth;

                                        const isBottomRight = isEventAtBottomRight(event);

                                        const handleMouseMove = (event: MouseEvent) => {
                                            const deltaX = event.clientX - startX;
                                            const deltaY = event.clientY - startY;
                                            const newX = initialX + deltaX * scaleFactor;
                                            const newY = initialY + deltaY * scaleFactor;
                                            const newWidth = initialWidth + deltaX * scaleFactor;
                                            const newHeight = initialHeight + deltaY * scaleFactor;

                                            if (isBottomRight) {
                                                box = { ...box!, width: newWidth, height: newHeight };
                                            } else {
                                                box = { ...box!, x: newX, y: newY };
                                            }
                                            setBoxes(boxes.map(b => b.id === boxId ? box! : b));
                                        };

                                        const handleMouseUp = () => {
                                            document.removeEventListener('mousemove', handleMouseMove);
                                            document.removeEventListener('mouseup', handleMouseUp);
                                            handleUpdateBox(box!);
                                        };

                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                    }
                                }}
                                onMouseMove={(event) => {
                                    const boxRef = event.currentTarget;
                                    const boxId = boxRef.getAttribute('data-box-id');
                                    const box = boxes.find(b => b.id === boxId);
                                    if (box) {
                                        if (isEventAtBottomRight(event)) {
                                            boxRef.style.cursor = 'se-resize';
                                        } else {
                                            boxRef.style.cursor = 'move';
                                        }
                                    }
                                }}
                            >
                                {box.name}
                            </div>
                        ))}
                </div>
            </div> {/* End of video/box wrapper */}

            {/* Sidebar */}
            <div style={{ width: '30%', padding: '10px', borderLeft: '1px solid #ccc', overflowY: 'auto' }}> {/* Sidebar, taking 30% width */}
                <div style={{ paddingBottom: '10px', borderBottom: '1px solid #eee', marginBottom: '10px' }}>
                    <span>ROIs</span> <button onClick={addBox} style={{ marginTop: '10px' }}>Add</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0px' }}> {/* Flex grid for items */}
                    {boxes.sort((a, b) => a.start - b.start).map(box => (
                        <SidebarItem key={box.id} box={box} onUpdateBox={handleUpdateBox} onDeleteBox={handleDeleteBox} currentTime={currentTime} />
                    ))}
                </div>
            </div> {/* End of sidebar */}

        </div>
    );
};

export default VideoPlayer;
