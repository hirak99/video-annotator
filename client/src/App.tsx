import './App.css';
import './VideoLabel.tsx'
import VideoPlayer from './VideoLabel';
import Login from './Login';
import { BrowserRouter as Router, Routes, Route } from 'react-router';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/app" element={<VideoPlayer />} />
            </Routes>
        </Router>
    );
}

export default App;
