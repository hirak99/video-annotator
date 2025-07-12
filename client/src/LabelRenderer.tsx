import { Box } from './types';
import { hashToHSLColor, stringToHash } from './utils';

interface LabelRendererProps {
    boxes: Box[];
    currentTime: number;
    videoDimensions: {
        naturalWidth: number;
        naturalHeight: number;
        displayWidth: number;
        displayHeight: number;
    };
    handleUpdateBox: (updatedBox: Box) => void;
    setBoxes: (updatedBoxes: Box[]) => void;
}

const LabelRenderer: React.FC<LabelRendererProps> = ({ boxes, currentTime, videoDimensions, handleUpdateBox, setBoxes }) => {
    const scaleFactorX = videoDimensions.naturalWidth / videoDimensions.displayWidth;
    const scaleFactorY = videoDimensions.naturalHeight / videoDimensions.displayHeight;

    const isEventAtBottomRight = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        return event.clientX >= rect.right - 10 && event.clientY >= rect.bottom - 10;
    };

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {boxes
                .filter(box => currentTime >= box.start && currentTime <= box.end)
                .map((box) => (
                    <div
                        key={box.id}
                        data-box-id={box.id}
                        style={{
                            position: 'absolute',
                            top: `${box.y / scaleFactorY}px`,
                            left: `${box.x / scaleFactorX}px`,
                            width: `${box.width / scaleFactorX}px`,
                            height: `${box.height / scaleFactorY}px`,
                            border: `2px solid ${hashToHSLColor(stringToHash(box.name))}`,
                            background: `${hashToHSLColor(stringToHash(box.name)).replace('hsl', 'hsla').replace(')', ', 0.3)')}`, // Add alpha for background
                            pointerEvents: 'auto',
                        }}
                        onMouseDown={(event) => {
                            event.preventDefault();  // Prevent default e.g. click and drag selection.
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

                                const isBottomRight = isEventAtBottomRight(event);

                                const handleMouseMove = (event: MouseEvent) => {
                                    const deltaX = event.clientX - startX;
                                    const deltaY = event.clientY - startY;
                                    const newX = initialX + deltaX * scaleFactorX;
                                    const newY = initialY + deltaY * scaleFactorY;
                                    const newWidth = initialWidth + deltaX * scaleFactorX;
                                    const newHeight = initialHeight + deltaY * scaleFactorY;

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
    );
};

export default LabelRenderer;
