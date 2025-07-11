import React, { useState, useEffect, useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';
import axios from 'axios';
import SidebarItem from './SidebarItem';
import { Box, LabelType } from './types';
import LabelRenderer from './LabelRenderer';

// Backend URL. E.g. 'http://localhost:8002'.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL

// Function to get from backend.
const getBackendPromise = async (endpoint: string, id?: number) => {
    return axios.get(`${BACKEND_URL}${endpoint}${id ? `/${id}` : ''}`);
};

const VideoPlayer: React.FC = () => {
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [labelError, setLabelError] = useState<string>("");
    const [currentVideoIdx, setCurrentVideoIdx] = useState<number>(0);
    const [videoFiles, setVideoFiles] = useState<any[]>([]);
    const [labelTypes, setLabelTypes] = useState<LabelType[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);  // Track current video time (absolute)
    const [videoDimensions, setVideoDimensions] = useState({
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0
    });
    const playerRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        getBackendPromise('/api/label-types').then(response => {
            setLabelTypes(response.data);
        })
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

    useEffect(() => {
        // Check if box intervals overlap in time with same type of label, for any labelType which should not overlap.
        const overlappingLabels: { [key: string]: { start: number; end: number; id: string }[] } = {};

        for (const box of boxes) {
            const labelType = labelTypes.find(lt => lt.name === box.name);
            if (labelType && !labelType.allow_overlap) {
                if (!overlappingLabels[box.name]) {
                    overlappingLabels[box.name] = [];
                }
                overlappingLabels[box.name].push({ start: box.start, end: box.end, id: box.id });
            }
        }

        // Store the overlapping label names in an array.
        const overlappingLabelNames: string[] = [];
        for (const labelName in overlappingLabels) {
            const intervals = overlappingLabels[labelName].sort((a, b) => a.start - b.start);
            for (let i = 0; i < intervals.length - 1; i++) {
                if (intervals[i].end > intervals[i + 1].start) {
                    overlappingLabelNames.push(`${labelName} (at ${intervals[i].end})`);
                    break;
                }
            }
        }

        // Generate an error of the form "Following labels do not allow overlap: 'person1', 'person2'. Please remove any overlap in time."
        let error = "";
        if (overlappingLabelNames.length > 0) {
            error = `Overlap not allowed for label types: '${overlappingLabelNames.join("', '")}'. Please edit to remove overlap.`;
        }

        setLabelError(error);
    }, [boxes, labelTypes]);

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
            // First of the labelTypes.
            name: labelTypes[0].name,
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

    return (
        <div>
            {/* List of videos */}
            <select className="video-select" value={currentVideoIdx} onChange={(e) => setCurrentVideoIdx(Number(e.target.value))}>
                {videoFiles.map((file, index) => (
                    <option key={index} value={index}>{file["video_file"]}</option>
                ))}
            </select>

            <div style={{ display: 'flex' }}> {/* Main container with flex display */}
                <div style={{ position: 'relative', width: '70%' }}> {/* Video/Box wrapper, taking 70% width */}
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
                    <LabelRenderer
                        boxes={boxes}
                        currentTime={currentTime}
                        videoDimensions={videoDimensions}
                        handleUpdateBox={handleUpdateBox}
                        setBoxes={setBoxes}
                    />
                </div> {/* End of video/box wrapper */}

                {/* Sidebar */}
                <div style={{ width: '30%', padding: '10px', borderLeft: '1px solid #ccc', overflowY: 'auto' }}> {/* Sidebar, taking 30% width */}
                    <div style={{
                        paddingBottom: '10px',
                        borderBottom: '1px solid #eee',
                        marginBottom: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Regions of Interest</span>
                        <button onClick={addBox} style={{ marginTop: '10px' }}>Add</button>
                    </div>

                    {/* Div to show labelError and hidden if error is empty */}
                    {labelError && (
                        <div style={{ color: 'red', marginBottom: '10px', textAlign: 'center' }}>
                            {labelError}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0px' }}> {/* Flex grid for items */}
                        {boxes.sort((a, b) => a.start - b.start).map(box => (
                            <SidebarItem key={box.id} labelTypes={labelTypes} box={box} onUpdateBox={handleUpdateBox} onDeleteBox={handleDeleteBox} currentTime={currentTime} />
                        ))}
                    </div>
                </div> {/* End of sidebar */}
            </div>
        </div>
    );
};

export default VideoPlayer;
