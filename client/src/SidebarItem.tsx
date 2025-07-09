import React, { useState } from 'react';
import { Box } from './types';

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
};

const parseTime = (timeString: string): number => {
  const [minutes, seconds] = timeString.split(':').map(Number);
  return minutes * 60 + seconds;
};

interface SidebarItemProps {
    box: Box;
    onUpdateBox: (updatedBox: Box) => void;
    onDeleteBox: (boxId: string) => void; // Add onDeleteBox prop
    currentTime: number; // Add currentTime prop
}

const SidebarItem: React.FC<SidebarItemProps> = ({ box, onUpdateBox, onDeleteBox, currentTime }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingStart, setIsEditingStart] = useState(false);
    const [isEditingEnd, setIsEditingEnd] = useState(false);
    const [boxName, setBoxName] = useState(box.name);
    const [startTime, setStartTime] = useState(formatTime(box.start));
    const [endTime, setEndTime] = useState(formatTime(box.end));

    const handleNameClick = () => {
        setIsEditingName(true);
    };

    const handleStartClick = () => {
        setIsEditingStart(true);
    };

    const handleEndClick = () => {
        setIsEditingEnd(true);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBoxName(e.target.value);
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartTime(e.target.value);
    };

    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndTime(e.target.value);
    };

    const handleNameBlur = () => {
        onUpdateBox({ ...box, name: boxName });
        setIsEditingName(false);
    };

    const handleStartBlur = () => {
        try {
            const newStartTime = parseTime(startTime);
            onUpdateBox({ ...box, start: newStartTime });
            setStartTime(formatTime(newStartTime));
        } catch {
            setStartTime(formatTime(box.start)); // Revert if invalid input
        }
        setIsEditingStart(false);
    };

    const handleEndBlur = () => {
        try {
            const newEndTime = parseTime(endTime);
            onUpdateBox({ ...box, end: newEndTime });
            setEndTime(formatTime(newEndTime));
        } catch {
            setEndTime(formatTime(box.end)); // Revert if invalid input
        }
        setIsEditingEnd(false);
    };

    const handleSetStart = () => {
        onUpdateBox({ ...box, start: currentTime });
        setStartTime(formatTime(currentTime)); // Update local state immediately
    };

    const handleSetEnd = () => {
        onUpdateBox({ ...box, end: currentTime });
        setEndTime(formatTime(currentTime)); // Update local state immediately
    };


    return (
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px', display: 'grid', gridTemplateColumns: '120px 80px 80px 1fr', gap: '10px', alignItems: 'center' }}>
            {/* Box Name */}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isEditingName ? (
                    <input
                        type="text"
                        value={boxName}
                        onChange={handleNameChange}
                        onBlur={handleNameBlur}
                        autoFocus
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                    />
                ) : (
                    <strong onClick={handleNameClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' }}>
                        {box.name}
                    </strong>
                )}
            </div>

            {/* Start Time */}
            <div>
                {isEditingStart ? (
                    <input
                        type="text"
                        value={startTime}
                        onChange={handleStartTimeChange}
                        onBlur={handleStartBlur}
                        autoFocus
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                        placeholder="mm:ss.ss"
                    />
                ) : (
                    <span onClick={handleStartClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' }}>
                        {formatTime(box.start)}
                    </span>
                )}
            </div>

            {/* End Time */}
            <div>
                {isEditingEnd ? (
                    <input
                        type="text"
                        value={endTime}
                        onChange={handleEndTimeChange}
                        onBlur={handleEndBlur}
                        autoFocus
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                        placeholder="mm:ss.ss"
                    />
                ) : (
                    <span onClick={handleEndClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' }}>
                        {formatTime(box.end)}
                    </span>
                )}
            </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={handleSetStart} style={{ padding: '2px 5px' }} aria-label="Set Start Time">◁</button> {/* Using a play icon */}
                    <button onClick={handleSetEnd} style={{ padding: '2px 5px' }} aria-label="Set End Time">▷</button> {/* Using a stop icon */}
                    <button onClick={() => onDeleteBox(box.id)} style={{ padding: '2px 5px', color: 'red' }} aria-label="Delete Box">✖</button> {/* Using a cross icon */}
                </div>
            </div>
    );
};

export default SidebarItem;
