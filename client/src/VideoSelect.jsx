import React from 'react';
import Select from 'react-select';

const VideoSelect = ({ videoFiles, currentVideoIdx, setCurrentVideoIdx }) => {
    const options = videoFiles.map((file, index) => ({
        value: index,
        label: file.video_file
    }));

    const selectedOption = options.find(option => option.value === currentVideoIdx);

    const handleChange = (selectedOption) => {
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
