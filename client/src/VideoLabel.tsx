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

const VideoPlayer: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState<string>('');  // Base video URL
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);  // Track current video time
  const [chunkUrl, setChunkUrl] = useState<string>('');     // Video chunk URL
  const videoRef = useRef<any>(null);

  useEffect(() => {
    // Fetch video URL and initial label data from the backend
    axios.get('/api/video-url').then(response => {
      setVideoUrl(response.data.url);  // For initial video URL
    });
    axios.get('/api/labels').then(response => {
      setBoxes(response.data);  // Get labeled boxes data
    });
  }, []);

  const handleTimeChange = (time: number) => {
    setCurrentTime(time);
    fetchVideoChunk(time, time + 5);  // Request a chunk for the next 5 seconds
  };

  const fetchVideoChunk = (startTime: number, endTime: number) => {
    // Construct the URL for the video chunk request
    const chunkUrl = `/api/video-chunk?start=${startTime}&end=${endTime}`;
    setChunkUrl(chunkUrl);  // Store the chunk URL

    // You could also handle loading of the chunk into the player (optional)
  };

  const handleVideoSeek = (time: number) => {
    setCurrentTime(time);
    fetchVideoChunk(time, time + 5);  // Request a chunk based on the seek time
  };

  const addBox = () => {
    const newBox = {
      id: Date.now().toString(),
      name: 'New Box',
      start: currentTime,
      end: currentTime + 5,
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    };
    setBoxes([...boxes, newBox]);
    axios.post('/api/add-label', newBox);  // Save new label on the server
  };

  return (
    <div>
      {/* Video Player */}
      <ReactPlayer
        ref={videoRef}
        url={chunkUrl || videoUrl}  // Use chunkUrl if available, else fallback to base video URL
        controls
        onProgress={({ playedSeconds }) => handleTimeChange(playedSeconds)}  // Handle scrubbing
        onSeek={handleVideoSeek}  // Handle manual seeking
      />

      {/* Label Boxes */}
      <div>
        {boxes.map((box) => (
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
