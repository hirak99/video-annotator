import React, { useState } from 'react';
import { Box } from './types';

interface SidebarItemProps {
    box: Box;
    onUpdateBox: (updatedBox: Box) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ box, onUpdateBox }) => {
    const [isEditingStart, setIsEditingStart] = useState(false);
    const [isEditingEnd, setIsEditingEnd] = useState(false);
    const [startTime, setStartTime] = useState(box.start.toFixed(2));
    const [endTime, setEndTime] = useState(box.end.toFixed(2));

    const handleStartClick = () => {
        setIsEditingStart(true);
    };

    const handleEndClick = () => {
        setIsEditingEnd(true);
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartTime(e.target.value);
    };

    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndTime(e.target.value);
    };

    const handleStartBlur = () => {
        const newStartTime = parseFloat(startTime);
        if (!isNaN(newStartTime)) {
            onUpdateBox({ ...box, start: newStartTime });
        } else {
            setStartTime(box.start.toFixed(2)); // Revert if invalid input
        }
        setIsEditingStart(false);
    };

    const handleEndBlur = () => {
        const newEndTime = parseFloat(endTime);
        if (!isNaN(newEndTime)) {
            onUpdateBox({ ...box, end: newEndTime });
        } else {
            setEndTime(box.end.toFixed(2)); // Revert if invalid input
        }
        setIsEditingEnd(false);
    };

    return (
        <li>
            <strong>{box.name}</strong> (Time:
            {isEditingStart ? (
                <input
                    type="number"
                    step="0.01"
                    value={startTime}
                    onChange={handleStartTimeChange}
                    onBlur={handleStartBlur}
                    autoFocus
                    style={{ width: '60px', margin: '0 5px', padding: '2px', border: '1px solid #ccc' }}
                />
            ) : (
                <span onClick={handleStartClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px', margin: '0 5px' }}>
                    {box.start.toFixed(2)}s
                </span>
            )}
             -
            {isEditingEnd ? (
                <input
                    type="number"
                    step="0.01"
                    value={endTime}
                    onChange={handleEndTimeChange}
                    onBlur={handleEndBlur}
                    autoFocus
                    style={{ width: '60px', margin: '0 5px', padding: '2px', border: '1px solid #ccc' }}
                />
            ) : (
                <span onClick={handleEndClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px', margin: '0 5px' }}>
                    {box.end.toFixed(2)}s
                </span>
            )}
            )
        </li>
    );
};

export default SidebarItem;
