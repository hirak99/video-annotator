import './App.css';
import './VideoLabel.tsx'
import VideoPlayer from './VideoLabel';

function App() {
    return (
        <div className="App">
            <header className="App-header">
                <p>
                    Video Labeler
                </p>
            </header>
            <VideoPlayer />
        </div>
    );
}

export default App;
