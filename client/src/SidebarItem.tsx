import React from 'react';

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

interface SidebarItemProps {
    box: Box;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ box }) => {
    return (
        <div>
            <strong>{box.name}</strong> (Time: {box.start.toFixed(2)}s - {box.end.toFixed(2)}s)
        </div>
    );
};

export default SidebarItem;
