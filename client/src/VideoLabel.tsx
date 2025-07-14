import React, { useState, useEffect, useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';
import axios from 'axios';
import SidebarItem from './SidebarItem';
import { io, Socket } from "socket.io-client";
import { AnnotationProps, LabelType } from './types';
import LabelRenderer from './LabelRenderer';
import { useNavigate } from 'react-router';
import { generateRandomString } from './utils'

axios.defaults.withCredentials = true;


// Backend URL. E.g. 'http://localhost:8002'.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL

// Function to get from backend.
const getBackendPromise = async (endpoint: string, id?: number) => {
    return axios.get(`${BACKEND_URL}${endpoint}${id ? `/${id}` : ''}`);
};

const VideoPlayer: React.FC = () => {

    const [username, setUsername] = useState<string | null>(null);
    const [enableEdit, setEnableEdit] = useState<boolean>(false);
    const [blinkEdit, setBlinkEdit] = useState<boolean>(false);
    const [boxes, setBoxes] = useState<AnnotationProps[]>([]);
    const lastBackendBoxes = useRef<AnnotationProps[]>([]);
    const [seeking, setSeeking] = useState(false);
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [labelError, setLabelError] = useState<string>("");
    const [currentVideoIdx, setCurrentVideoIdx] = useState<number>(0);
    const [videoFiles, setVideoFiles] = useState<any[]>([]);
    const [labelTypes, setLabelTypes] = useState<LabelType[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [videoDimensions, setVideoDimensions] = useState({
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0
    });
    // Number of time any label update method was posted to backend. If this is not 0, backend is working to save.
    const [savingCount, setSavingCount] = useState(0);
    const saving = savingCount > 0;
    const playerRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();

    // Helper to show "Saving..." during any label save operation (supports multiple concurrent ops)
    const withSaving = <T,>(promise: Promise<T>) => {
        setSavingCount(count => count + 1);
        return promise.finally(() => {
            setSavingCount(count => Math.max(0, count - 1));
        });
    };

    useEffect(() => {
        // Fetch the current logged-in username
        axios.get(`${BACKEND_URL}/api/current-user`)
            .then(res => setUsername(res.data.username))
            .catch(() => setUsername(null));
    }, []);

    useEffect(() => {
        getBackendPromise('/api/label-types').then(response => {
            setLabelTypes(response.data);
        })
        getBackendPromise('/api/video-files').then(response => {
            const videoFiles = response.data;
            if (videoFiles["needs_login"]) {
                navigate("/");
            }
            setVideoFiles(videoFiles); // Store video files
            if (videoFiles.length > 0) {
                setCurrentVideoIdx(0);
            }
        });
    }, [navigate]);

    useEffect(() => {
        // Socket.IO connection for real-time label updates
        const socketUrl = BACKEND_URL?.replace(/^http/, "ws") || "";
        const socket: Socket = io(socketUrl, { transports: ["websocket"] });
        socket.on("labels_updated", (data: { video_id: number }) => {
            if (data.video_id === currentVideoIdx) {
                getBackendPromise(`/api/labels/${currentVideoIdx}`).then(response => {
                    setBoxes(response.data);
                    lastBackendBoxes.current = response.data;
                });
            }
        });
        return () => {
            socket.disconnect();
        };
    }, [currentVideoIdx]);

    useEffect(() => {
        getBackendPromise(`/api/labels/${currentVideoIdx}`).then(response => {
            setBoxes(response.data);  // Get labeled boxes data for the current video
            lastBackendBoxes.current = response.data;
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
                overlappingLabels[box.name].push({ start: box.label.start, end: box.label.end, id: box.id });
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

    // Utility to set boxes and push to backend (throttled)
    const throttleTimeout = useRef<NodeJS.Timeout | null>(null);
    const latestBoxesRef = useRef<AnnotationProps[]>([]);
    const setAndUpdateBoxes = (newBoxes: AnnotationProps[]) => {
        if (!enableEdit) {
            setBoxes(lastBackendBoxes.current);
            // Blink the enableEdit label twice
            setBlinkEdit(true);
            setTimeout(() => setBlinkEdit(false), 150);
            setTimeout(() => setBlinkEdit(true), 300);
            setTimeout(() => setBlinkEdit(false), 450);
            return;
        }
        setBoxes(newBoxes);
        latestBoxesRef.current = newBoxes;
        if (throttleTimeout.current) {
            clearTimeout(throttleTimeout.current);
        }
        throttleTimeout.current = setTimeout(() => {
            withSaving(
                axios.post(`${BACKEND_URL}/api/set-labels/${currentVideoIdx}`, latestBoxesRef.current)
            );
            throttleTimeout.current = null;
        }, 500);
    };

    const handleDeleteBox = (boxId: string) => {
        setAndUpdateBoxes(boxes.filter(box => box.id !== boxId));
    };

    const handleUpdateBox = (updatedBox: AnnotationProps) => {
        setAndUpdateBoxes(boxes.map(box => box.id === updatedBox.id ? updatedBox : box));
    };

    const addBox = () => {
        const newBox: AnnotationProps = {
            // Date includes milliseconds. Add a random str anyway, to make collisions practically impossible.
            id: Date.now().toString() + "_" + generateRandomString(7),
            // First of the labelTypes.
            name: labelTypes[0].name,
            creator: username || "",
            label: {
                annotation_type: "Box",
                start: currentTime,
                end: currentTime + 10, // Assuming a default duration for a new box
                x: 50,
                y: 50,
                width: 100,
                height: 100,
            }
        };
        setAndUpdateBoxes([...boxes, newBox]);
        setSelectedBoxId(newBox.id);
    };

    // Prevent window close/navigation if saving is true or a save is scheduled
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        const shouldPrevent = saving || throttleTimeout.current !== null;
        if (shouldPrevent) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        } else {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }
        // Cleanup on unmount
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [saving]);

    // Seek video and update state
    const seekToTime = (time: number) => {
        if (playerRef.current) {
            setSeeking(true);
            playerRef.current.currentTime = time;
            playerRef.current.pause();
        }
    };

    // Listen for seeked event to clear seeking indicator
    React.useEffect(() => {
        const video = playerRef.current;
        if (!video) return;
        const handleSeeked = () => setSeeking(false);
        video.addEventListener('seeked', handleSeeked);
        return () => {
            video.removeEventListener('seeked', handleSeeked);
        };
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <label style={{
                        textShadow: blinkEdit ? '1px 0 0 red, -1px 0 0 red' : '',
                    }}>
                        <input
                            type="checkbox"
                            checked={enableEdit}
                            onChange={e => setEnableEdit(e.target.checked)}
                            style={{ marginRight: '6px' }}
                        />
                        {!enableEdit && <span style={{ color: "red", marginLeft: "5px" }}>For safety, EDITING IS DISABLED. Click to enable.</span>}
                        {enableEdit && <span style={{ color: "green", marginLeft: "5px" }}>Editing is now enabled.</span>}
                    </label>
                </div>
                <button onClick={() => { navigate("/"); }}>Logout</button>
            </div>
            {/* List of videos */}
            <select className="video-select" value={currentVideoIdx} onChange={(e) => setCurrentVideoIdx(Number(e.target.value))}>
                {videoFiles.map((file, index) => (
                    <option key={index} value={index}>{file["video_file"]}</option>
                ))}
            </select>

            <div style={{ display: 'flex' }}> {/* Main container with flex display */}
                <div style={{ width: '70%' }}>
                    {/* Video and boxes. Everything in this div must have relative positioning. */}
                    <div style={{ position: 'relative' }}>
                        {/* Video Player */}
                        <video
                            ref={playerRef}
                            src={`${BACKEND_URL}/api/video/${currentVideoIdx}`}
                            controls
                            controlsList='nofullscreen'  // Seems Firefox does not respect this.
                            disablePictureInPicture
                            muted
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleVideoLoad}
                            style={{ width: '100%', backgroundColor: 'black' }}
                        />

                        {saving &&
                            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                                Saving...
                            </div>
                        }
                        {seeking &&
                            <div className="seeking-overlay">
                                <div className="seeking-spinner"></div>
                                <div className="seeking-text">Seeking...</div>
                            </div>
                        }

                        {/* Label Boxes */}
                        <LabelRenderer
                            boxes={boxes}
                            currentTime={currentTime}
                            videoDimensions={videoDimensions}
                            handleUpdateBox={handleUpdateBox}
                            setBoxes={setBoxes}
                            setAndUpdateBoxes={setAndUpdateBoxes}
                            selectedBoxId={selectedBoxId}
                            setSelectedBoxId={setSelectedBoxId}
                        />
                    </div>
                    {/* Video Seek Controls */}
                    <div className="media-controls">
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime - 1); }}>⏪ -1s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime - 0.5); }}>-0.5s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime - 0.1); }}>-0.1s</button>

                        {/* Play / pause button */}
                        <button className="media-btn" onClick={() => {
                            if (!playerRef.current) return;
                            if (playerRef.current.paused) {
                                playerRef.current.play();
                            } else {
                                playerRef.current.pause();
                            }
                        }}>
                            {playerRef.current && playerRef.current.paused ? '▶️' : '⏸️'}
                        </button>

                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime + 0.1); }}>+0.1s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime + 0.5); }}>+0.5s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime + 1); }}>+1s ⏩</button>
                    </div>
                </div> {/* End of video/box wrapper */}

                {/* Sidebar */}
                <div
                    style={{
                        width: '30%', // Sidebar takes 30% width.
                        padding: '10px',
                        borderLeft: '1px solid #ccc',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{
                        paddingBottom: '10px',
                        borderBottom: '1px solid #eee',
                        marginBottom: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Regions of Interest</span>
                        <button onClick={addBox}>Add</button>
                    </div>

                    {/* Div to show labelError and hidden if error is empty */}
                    {labelError && (
                        <div style={{ color: 'red', marginBottom: '10px', textAlign: 'center' }}>
                            {labelError}
                        </div>
                    )}

                    {/* List of all the annotations. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0px' }}> {/* Flex grid for items */}
                        {boxes.map((box, index) => (
                            <SidebarItem
                                index={index}
                                key={box.id}
                                labelTypes={labelTypes}
                                box={box}
                                onUpdateBox={handleUpdateBox}
                                onDeleteBox={handleDeleteBox}
                                currentTime={currentTime}
                                selectedBoxId={selectedBoxId}
                                setSelectedBoxId={setSelectedBoxId}
                                seekToTime={seekToTime}
                            />
                        ))}
                    </div>
                </div> {/* End of sidebar */}
            </div>
        </div>
    );
};

export default VideoPlayer;
