import React, { useState, useEffect, useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';
import axios from 'axios';
import { io, Socket } from "socket.io-client";
import { AnnotationProps, LabelType } from './types';
import LabelRenderer from './LabelRenderer';
import { useNavigate } from 'react-router';
import { generateRandomString } from './utils'
import VideoSeekBar from './VideoSeekBar';
import Sidebar from './Sidebar';
import VideoSelect from './VideoSelect';

axios.defaults.withCredentials = true;


// Backend URL. E.g. 'http://localhost:8002'.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL

// Function to get from backend.
const getBackendPromise = async (endpoint: string, id?: number) => {
    return axios.get(`${BACKEND_URL}${endpoint}${id ? `/${id}` : ''}`);
};

interface VideoFileProps {
    video_file: string;
    label_file: string;  // Not directly used by the client. Server handles save and load to json.
    readonly: boolean;
}

const VideoPlayer: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [buffering, setBuffering] = useState<boolean>(false);
    // Unique client id for socket event filtering
    const clientIdRef = useRef<string>(generateRandomString(16));
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [enableEdit, setEnableEdit] = useState<boolean>(false);
    const [blinkEdit, setBlinkEdit] = useState<boolean>(false);
    const [boxes, setBoxes] = useState<AnnotationProps[]>([]);
    const lastBackendBoxes = useRef<AnnotationProps[]>([]);
    const [seeking, setSeeking] = useState(false);
    const [loading, setLoading] = useState(true); // New loading state
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [currentVideoIdx, setCurrentVideoIdx] = useState<number>(0);
    const [videoFiles, setVideoFiles] = useState<VideoFileProps[]>([]);
    const [labelTypes, setLabelTypes] = useState<LabelType[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);

    // Thumbnail sprite URL fetched from server
    const [thumbSpriteUrl, setThumbSpriteUrl] = useState<string>("");

    useEffect(() => {
        if (!BACKEND_URL) return;
        // Sprite is now served directly as image/jpeg
        setThumbSpriteUrl(`${BACKEND_URL}/api/thumbnail-sprite/${currentVideoIdx}`);
    }, [currentVideoIdx]);

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
        socket.on("labels_updated", (data: { video_id: number, client_id?: string }) => {
            // Ignore if this client initiated the change
            if (data.client_id && data.client_id === clientIdRef.current) return;
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

    // High-frequency currentTime update using requestAnimationFrame
    useEffect(() => {
        let rafId: number | null = null;
        const update = () => {
            if (playerRef.current && !playerRef.current.paused && !playerRef.current.ended) {
                setCurrentTime(playerRef.current.currentTime);
                rafId = requestAnimationFrame(update);
            }
        };
        const currentPlayer = playerRef.current;
        if (currentPlayer) {
            const onPlay = () => {
                setIsPlaying(true);
                setBuffering(false);
                rafId = requestAnimationFrame(update);
            };
            const onPause = () => {
                setIsPlaying(false);
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
            };
            const onWaiting = () => setBuffering(true);
            const onCanPlay = () => setBuffering(false);

            currentPlayer.addEventListener('play', onPlay);
            currentPlayer.addEventListener('pause', onPause);
            currentPlayer.addEventListener('waiting', onWaiting);
            currentPlayer.addEventListener('canplay', onCanPlay);

            // Set initial state
            setIsPlaying(!currentPlayer.paused && !currentPlayer.ended);
            setBuffering(false);

            // Start if already playing
            if (!currentPlayer.paused && !currentPlayer.ended) {
                rafId = requestAnimationFrame(update);
            }
            // React will call this to clean up once the effect unloads.
            return () => {
                currentPlayer.removeEventListener('play', onPlay);
                currentPlayer.removeEventListener('pause', onPause);
                currentPlayer.removeEventListener('waiting', onWaiting);
                currentPlayer.removeEventListener('canplay', onCanPlay);
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                }
            };
        }
    }, []);

    const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        setVideoDimensions({
            naturalWidth: video.videoWidth,
            naturalHeight: video.videoHeight,
            displayWidth: video.clientWidth,
            displayHeight: video.clientHeight
        });
        setPlaybackRate(video.playbackRate);
        setLoading(false); // Video is ready, stop loading
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

    // Utility to set boxes and push to backend (throttled)
    const throttleTimeout = useRef<NodeJS.Timeout | null>(null);
    const latestBoxesRef = useRef<AnnotationProps[]>([]);
    const setAndUpdateBoxes = (newBoxes: AnnotationProps[]) => {
        if (!enableEdit) {
            // Reset to last known boxes that were saved to, or obtained from backend.
            // I.e. revert any changes that may have been made but not saved.
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
                axios.post(
                    `${BACKEND_URL}/api/set-labels/${currentVideoIdx}`,
                    {
                        labels: latestBoxesRef.current,
                        client_id: clientIdRef.current,
                    }
                )
            );
            // Update what is now known to the backend.
            lastBackendBoxes.current = latestBoxesRef.current;
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
            label: {
                annotation_type: "Box",
                start: currentTime,
                end: currentTime + 10, // Assuming a default duration for a new box
                x: 50 * videoDimensions.naturalWidth / videoDimensions.displayWidth,
                y: 50 * videoDimensions.naturalHeight / videoDimensions.displayHeight,
                width: 100 * videoDimensions.naturalWidth / videoDimensions.displayWidth,
                height: 100 * videoDimensions.naturalHeight / videoDimensions.displayHeight,
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
        const handleSeeked = () => {
            setSeeking(false);
        };
        video.addEventListener('seeked', handleSeeked);
        return () => {
            video.removeEventListener('seeked', handleSeeked);
        };
    }, []);

    // Set loading to true when currentVideoIdx changes (new video selected)
    useEffect(() => {
        // Reset currentTime to 0 on new video load
        setCurrentTime(0);
        // Re-enable safety.
        setEnableEdit(false);
        // Display "Loading...". Cleared on load.
        setLoading(true);
    }, [currentVideoIdx]);

    // Optionally, set loading to false on error (not strictly required, but for robustness)
    const handleVideoError = () => {
        setLoading(false);
    };

    // Handler for playback rate change
    const handlePlaybackRateChange = (rate: number) => {
        setPlaybackRate(rate);
        if (playerRef.current) {
            playerRef.current.playbackRate = rate;
        }
    };

    // Ensure video playbackRate is updated if playbackRate state changes (e.g., on video load)
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    return (
        <div style={{ padding: '4px 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <label style={{
                        textShadow: blinkEdit ? '1px 0 0 red, -1px 0 0 red' : '',
                    }}>
                        <input
                            type="checkbox"
                            checked={enableEdit}
                            onChange={e => setEnableEdit(e.target.checked)}
                            disabled={videoFiles[currentVideoIdx]?.readonly}
                            style={{ marginRight: '6px' }}
                        />
                        {videoFiles[currentVideoIdx]?.readonly ? <span style={{ color: "orange", marginLeft: "5px" }}>File is readonly in the server. Request server admin for edit access.</span> :
                            enableEdit ? <span style={{ color: "green", marginLeft: "5px" }}>Editing is now enabled.</span> :
                                <span style={{ color: "red", marginLeft: "5px" }}>For safety, EDITING IS DISABLED. Click to enable.</span>}
                    </label>
                </div>
                <button onClick={() => { navigate("/"); }}>Logout</button>
            </div>

            <VideoSelect
                videoFiles={videoFiles}
                currentVideoIdx={currentVideoIdx}
                setCurrentVideoIdx={setCurrentVideoIdx}
            />

            <div style={{ display: 'flex' }}> {/* Main container with flex display */}
                <div style={{ width: '70%' }}>
                    {/* Video and boxes. Everything in this div must have relative positioning. */}
                    <div style={{ position: 'relative' }}>
                        {/* Video Player */}
                        <video
                            controls
                            controlsList='nofullscreen'  // Seems Firefox does not respect this.
                            disablePictureInPicture
                            muted
                            // Could help with error "fetching process of the media was abotrted at user's request".
                            onAbort={() => console.debug('Video fetch aborted')}
                            onClick={() => {
                                // Play / pause.
                                if (!playerRef.current) return;
                                if (playerRef.current.paused) {
                                    playerRef.current.play();
                                } else {
                                    playerRef.current.pause();
                                }
                            }}
                            onError={handleVideoError}
                            onLoadedMetadata={handleVideoLoad}
                            onTimeUpdate={handleTimeUpdate}
                            preload='metadata'
                            ref={playerRef}
                            src={`${BACKEND_URL}/api/video/${currentVideoIdx}`}
                            style={{ width: '100%', backgroundColor: 'black' }}
                        />

                        {saving &&
                            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                                Saving...
                            </div>
                        }

                        {(loading || buffering || seeking) &&
                            <div className="seeking-overlay">
                                <div className="seeking-spinner"></div>
                                <div className="seeking-text">{loading ? "Loading..." : buffering ? "Buffering..." : "Seeking..."}</div>
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
                            labelTypes={labelTypes}
                        />
                    </div>

                    {/* Video Seek Bar */}
                    <VideoSeekBar
                        duration={playerRef.current ? playerRef.current.duration : 0}
                        currentTime={currentTime}
                        onSeek={(time: number) => {
                            if (playerRef.current) {
                                playerRef.current.currentTime = time;
                            }
                        }}
                        width={videoDimensions.displayWidth}
                        thumbSpriteUrl={thumbSpriteUrl}
                        playerRef={playerRef}
                    />

                    {/* Video Seek Controls */}
                    <div className="media-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime - 1); }}>⏪ -1s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime - 0.5); }}>-0.5s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime - 0.1); }}>-0.1s</button>

                        {/* Play / pause button */}
                        <button className="media-btn" style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            border: '1px solid',
                            color: '#ccc',
                        }} onClick={() => {
                            if (!playerRef.current) return;
                            if (!isPlaying) {
                                playerRef.current.play();
                            } else {
                                playerRef.current.pause();
                            }
                        }}>
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>

                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime + 0.1); }}>+0.1s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime + 0.5); }}>+0.5s</button>
                        <button className="media-btn" onClick={() => { seekToTime(playerRef.current!.currentTime + 1); }}>+1s ⏩</button>

                        {/* Playback Speed Controls */}
                        <label style={{ marginLeft: '16px' }}>
                            Speed:
                            <select
                                className='media-btn'
                                value={playbackRate}
                                onChange={e => handlePlaybackRateChange(Number(e.target.value))}
                                style={{
                                    appearance: 'none',  // Disables the down arrow.
                                    border: '1px solid #ccc',
                                    borderRadius: '2px',
                                    padding: '1px 8px',
                                    color: '#333',
                                    outline: 'none',
                                    marginLeft: '6px',
                                    textAlign: 'center',
                                }}
                            >
                                <option value={0.2}>0.2x</option>
                                <option value={0.5}>0.5x</option>
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                                <option value={4}>4x</option>
                            </select>
                        </label>
                    </div>
                </div> {/* End of video/box wrapper */}

                <Sidebar
                    boxes={boxes}
                    labelTypes={labelTypes}
                    addBox={addBox}
                    handleUpdateBox={handleUpdateBox}
                    handleDeleteBox={handleDeleteBox}
                    currentTime={currentTime}
                    selectedBoxId={selectedBoxId}
                    setSelectedBoxId={setSelectedBoxId}
                    seekToTime={seekToTime}
                    setAndUpdateBoxes={setAndUpdateBoxes}
                />
            </div>
        </div>
    );
};

export default VideoPlayer;
