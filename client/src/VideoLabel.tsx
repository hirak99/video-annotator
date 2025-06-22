// VideoPlayer.tsx
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
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = useRef<any>(null);

  useEffect(() => {
    // Fetch video URL and initial label data from server
    axios.get('/api/video-url').then(response => {
      setVideoUrl(response.data.url);
    });
    axios.get('/api/labels').then(response => {
      setBoxes(response.data);
    });
  }, []);

  const handleTimeChange = (time: number) => {
    setCurrentTime(time);
  };

  const handleLabelChange = (id: string, newBox: Box) => {
    setBoxes(prevBoxes => prevBoxes.map(box => (box.id === id ? newBox : box)));
    axios.post('/api/update-label', newBox);
  };

  const handleVideoSeek = (time: number) => {
    setCurrentTime(time);
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
    axios.post('/api/add-label', newBox);
  };

  return (
    <div>
      <ReactPlayer
        ref={videoRef}
        url={videoUrl}
        controls
        onProgress={({ playedSeconds }) => handleTimeChange(playedSeconds)}
        onSeek={handleVideoSeek}
      />
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
