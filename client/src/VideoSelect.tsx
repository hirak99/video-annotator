import React from 'react';
import Select from 'react-select';

interface VideoFileProps {
    video_file: string;
    label_file: string;
    readonly: boolean;
}

interface VideoSelectProps {
    videoFiles: VideoFileProps[];
    currentVideoIdx: number;
    setCurrentVideoIdx: React.Dispatch<React.SetStateAction<number>>;
}

const VideoSelect: React.FC<VideoSelectProps> = ({ videoFiles, currentVideoIdx, setCurrentVideoIdx }) => {
    const options = videoFiles.map((file, index) => ({
        value: index,
        label: file.video_file
    }));

    const selectedOption = options.find(option => option.value === currentVideoIdx);

    const handleChange = (selectedOption: any) => { // selectedOption type from react-select
        setCurrentVideoIdx(selectedOption ? selectedOption.value : null);
    };

    return (
        <Select
            className="video-select"
            value={selectedOption}
            onChange={handleChange}
            options={options}
            isSearchable={true}
            placeholder="Select a video..."
        />
    );
};

export default VideoSelect;
