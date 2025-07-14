import { Box, LabelType } from './types';

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
};

interface SidebarItemProps {
    index: number;
    labelTypes: LabelType[];
    box: Box;
    onUpdateBox: (updatedBox: Box) => void;
    onDeleteBox: (boxId: string) => void;
    currentTime: number;
    selectedBoxId: string | null;
    setSelectedBoxId: (id: string | null) => void;
    seekToTime: (time: number) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
    index,
    labelTypes,
    box,
    onUpdateBox,
    onDeleteBox,
    currentTime,
    selectedBoxId,
    setSelectedBoxId,
    seekToTime
}) => {

    const handleSetStart = () => {
        // If the start is less than end, set newEndTime to start + 1.
        const newEndTime = currentTime >= box.annotation.end ? currentTime + 1 : box.annotation.end;
        onUpdateBox({ ...box, annotation: { ...box.annotation, start: currentTime, end: newEndTime } });
    };

    const handleSetEnd = () => {
        onUpdateBox({ ...box, annotation: { ...box.annotation, end: currentTime } });
    };

    const isVisible = currentTime >= box.annotation.start && currentTime <= box.annotation.end;

    const handleClickSeekTime = (target: EventTarget, box: Box) => {
        if (target instanceof HTMLButtonElement) {
            // Do not seek on button clicks.
            // Buttons already do some action, like setting the time or deleting - and they can semantically conflict with seeking.
            return;
        }
        if (currentTime < box.annotation.start || currentTime > box.annotation.end) {
            seekToTime(box.annotation.start);
        }
    };


    return (
        <div
            className={isVisible ? "" : "dimmed"}
            style={{
                borderBottom: '1px solid #eee',
                paddingBottom: '5px',
                marginBottom: '5px',
                display: 'grid',
                gridTemplateColumns: 'min-content 1fr 90px 90px 30px',
                gap: '5px',
                alignItems: 'center',
                background: box.id === selectedBoxId ? '#e3f0ff' : undefined,
                boxShadow: box.id === selectedBoxId ? '0 0 0 2px #1976d2' : undefined,
                cursor: 'pointer'
            }}
            onMouseDown={() => setSelectedBoxId(box.id === selectedBoxId ? null : box.id)}
            onClick={(event) => handleClickSeekTime(event.target, box)}
        >
            {/* Index */}
            <div>{index + 1}.</div>

            {/* Box Name */}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                <select
                    key={box.id}
                    value={box.name}
                    onChange={(event) => {
                        onUpdateBox({ ...box, name: event.target.value });
                    }}
                    style={{ width: '100%', padding: '2px' }}
                >
                    {labelTypes.map((labelType) => (
                        <option key={labelType.name} value={labelType.name}>
                            {labelType.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Start Time */}
            <button onClick={handleSetStart} style={{
                padding: '2px 10px',
                marginLeft: 'auto',
            }} aria-label="Set Start Time">
                <span style={{ marginRight: '5px', position: 'relative', top: '-1px' }}>⧯</span> {formatTime(box.annotation.start)}
            </button>

            {/* End Time */}
            <button onClick={handleSetEnd} style={{
                padding: '2px 10px',
                marginRight: 'auto',
            }} aria-label="Set End Time">
                {formatTime(box.annotation.end)} <span style={{ marginLeft: '5px', position: 'relative', top: '-1px' }}>⧯</span>
            </button>

            {/* Delete */}
            <button onClick={() => onDeleteBox(box.id)} style={{ padding: '2px 5px', color: 'red' }} aria-label="Delete Box">✖</button> {/* Using a cross icon */}
        </div>
    );
};

export default SidebarItem;
