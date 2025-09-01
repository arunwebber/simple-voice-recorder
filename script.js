// Global utility functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// StorageManager Class: Handles saving to localStorage with debouncing
class StorageManager {
    static pendingWrites = new Map();
    static writeTimeout = null;

    static saveToLocalStorage(key, value) {
        this.pendingWrites.set(key, value);
        
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }
        
        this.writeTimeout = setTimeout(() => {
            this.flushWrites();
        }, 100);
    }

    static flushWrites() {
        this.pendingWrites.forEach((value, key) => {
            localStorage.setItem(key, value);
        });
        this.pendingWrites.clear();
        this.writeTimeout = null;
    }

    static getFromLocalStorage(key, defaultValue = null) {
        if (this.pendingWrites.has(key)) {
            return this.pendingWrites.get(key);
        }
        return localStorage.getItem(key) || defaultValue;
    }

    static removeFromLocalStorage(key) {
        this.pendingWrites.delete(key);
        localStorage.removeItem(key);
    }
}

// DarkModeManager Class: Handles dark mode toggle
class DarkModeManager {
    constructor(toggleSelector) {
        this.toggle = document.querySelector(toggleSelector);
        const savedMode = StorageManager.getFromLocalStorage("darkMode");
        if (savedMode === "enabled") {
            document.body.classList.add("dark-mode");
            this.toggle.checked = true;
        } else if (savedMode === "disabled") {
            document.body.classList.remove("dark-mode");
            this.toggle.checked = false;
        }

        this.toggle.addEventListener("change", () => this.toggleDarkMode());
    }

    toggleDarkMode() {
        if (this.toggle.checked) {
            document.body.classList.add("dark-mode");
            StorageManager.saveToLocalStorage("darkMode", "enabled");
        } else {
            document.body.classList.remove("dark-mode");
            StorageManager.saveToLocalStorage("darkMode", "disabled");
        }
    }
}

class RecordingLibrary {
    constructor() {
        this.libraryList = document.getElementById('libraryList');
        this.recordings = this.loadRecordings();
        this.renderRecordings();
    }

    loadRecordings() {
        try {
            const savedRecordings = StorageManager.getFromLocalStorage('recordings');
            return savedRecordings ? JSON.parse(savedRecordings) : [];
        } catch (e) {
            console.error("Failed to parse recordings from localStorage:", e);
            return [];
        }
    }

    saveRecordings() {
        StorageManager.saveToLocalStorage('recordings', JSON.stringify(this.recordings));
    }

    addRecording(blob, duration) {
        const reader = new FileReader();
        reader.onload = () => {
            const newRecording = {
                id: `rec-${Date.now()}`,
                name: `Recording ${this.recordings.length + 1}`,
                dataUrl: reader.result,
                duration: this.formatTime(duration)
            };
            this.recordings.unshift(newRecording); // Add to the beginning of the list
            this.saveRecordings();
            this.renderRecordings();
        };
        reader.readAsDataURL(blob);
    }

    renderRecordings() {
        this.libraryList.innerHTML = '';
        this.recordings.forEach((rec, index) => {
            const item = document.createElement('div');
            item.className = 'recording-item';
            item.innerHTML = `
                <div class="name">
                <span class="title">${rec.name}</span>
                <span class="duration">(${rec.duration})</span>
                </div>
                <div class="controls">
                    <button class="play-btn" data-index="${index}">&#9658;</button>
                    <button class="download-btn" data-index="${index}">&#x1F4BE;</button>
                    <button class="delete-btn" data-index="${index}">&#x1F5D1;</button>
                </div>
            `;
            this.libraryList.appendChild(item);
        });

        document.querySelectorAll('.play-btn').forEach(button => {
            button.addEventListener('click', (e) => this.playRecording(e.target.dataset.index));
        });
        document.querySelectorAll('.download-btn').forEach(button => {
            button.addEventListener('click', (e) => this.downloadRecording(e.target.dataset.index));
        });
        // Add event listener for the new delete button
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => this.deleteRecording(e.target.dataset.index));
        });
    }

    playRecording(index) {
        const recording = this.recordings[index];
        if (recording) {
            const audio = new Audio(recording.dataUrl);
            audio.play();
        }
    }

    downloadRecording(index) {
        const recording = this.recordings[index];
        if (recording) {
            const link = document.createElement('a');
            link.href = recording.dataUrl;
            link.download = `${recording.name}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    deleteRecording(index) {
        // Remove the recording at the specified index
        this.recordings.splice(index, 1);
        // Save the updated list to local storage
        this.saveRecordings();
        // Re-render the list to update the display
        this.renderRecordings();
    }
}

// Existing Voice Recorder Logic
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let canvas;
let canvasCtx;
let isRecording = false;
let isPaused = false;
let fullWaveformData = [];
let recordingStartTime;
let elapsedRecordingTime = 0; // In seconds
let stream;
let source;
let animationId;
let recordingTimeInterval;
let library;

document.addEventListener("DOMContentLoaded", () => {
    new DarkModeManager("#darkModeToggle");
    library = new RecordingLibrary();

    canvas = document.getElementById("waveform");
    canvasCtx = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 150;

    document.getElementById("start").addEventListener("click", toggleRecording);
    document.getElementById("stop").addEventListener("click", stopRecording);
    document.getElementById("rerecord").addEventListener("click", resetRecorder);
    document.getElementById("stop").disabled = true;
    
    // No-op event listeners for new buttons
    document.getElementById("settingsButton").addEventListener("click", () => alert("Settings button clicked!"));
    document.getElementById("aiWriteButton").addEventListener("click", () => alert("Write with AI button clicked!"));
});

async function toggleRecording() {
    if (isRecording) {
        if (!isPaused) {
            mediaRecorder.pause();
            isPaused = true;
            document.getElementById("start").innerHTML = "&#9658;"; // Play icon
            cancelAnimationFrame(animationId);
            clearInterval(recordingTimeInterval);
        } else {
            mediaRecorder.resume();
            isPaused = false;
            document.getElementById("start").innerHTML = "&#9208;"; // Pause icon
            drawProgressiveWaveform();
            startRecordingTime();
        }
    } else {
        await startNewRecording();
    }
}

async function startNewRecording() {
    try {
        console.log("Starting new recording...");
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        console.log("MediaRecorder created:", mediaRecorder);
        
        audioChunks = [];
        fullWaveformData = [];
        isRecording = true;
        isPaused = false;

        recordingStartTime = Date.now();
        elapsedRecordingTime = 0;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 2048;
        let bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        drawProgressiveWaveform();
        startRecordingTime();

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            console.log("MediaRecorder stopped");
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const duration = (Date.now() - recordingStartTime) / 1000;
            library.addRecording(audioBlob, duration);
            resetRecorder();
        };

        mediaRecorder.start();
        console.log("MediaRecorder state:", mediaRecorder.state);
        document.getElementById("start").innerHTML = "&#9208;";
        
        // Make sure the stop button is enabled after everything is set up
        const stopButton = document.getElementById("stop");
        stopButton.disabled = false;
        console.log("Stop button disabled state:", stopButton.disabled);
        
        document.getElementById("rerecord").style.display = 'none';

    } catch (err) {
        console.error("The following error occurred: " + err);
        alert("Microphone access was denied. Please allow it to use the recorder.");
        // Reset the state if there's an error
        isRecording = false;
        document.getElementById("start").innerHTML = "&#x1F3A4;";
    }
}
function startRecordingTime() {
    clearInterval(recordingTimeInterval);
    recordingTimeInterval = setInterval(() => {
        elapsedRecordingTime = (Date.now() - recordingStartTime) / 1000;
        document.getElementById("recording-length").textContent = `Recording length: ${elapsedRecordingTime.toFixed(3)} seconds`;
    }, 100);
}

function stopRecording() {
    console.log("Stop button clicked");
    console.log("MediaRecorder:", mediaRecorder);
    console.log("MediaRecorder state:", mediaRecorder?.state);
    
    if (mediaRecorder && (mediaRecorder.state === "recording" || mediaRecorder.state === "paused")) {
        console.log("Stopping recorder...");
        mediaRecorder.stop();
        // The rest of the cleanup is now handled in the mediaRecorder.onstop event handler
    } else {
        console.log("Recorder not in correct state to stop");
    }
}

function resetRecorder() {
    audioChunks = [];
    fullWaveformData = [];
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset button states
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("start").innerHTML = "&#x1F3A4;";
    document.getElementById("rerecord").style.display = 'none';
    
    if (source) {
        source.disconnect(analyser);
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    clearInterval(recordingTimeInterval);
    document.getElementById("recording-length").textContent = "Recording length: 0.00 seconds";
    isRecording = false;
    isPaused = false;
}

function drawProgressiveWaveform() {
    if (!isRecording || isPaused) return;
    animationId = requestAnimationFrame(drawProgressiveWaveform);
    analyser.getByteTimeDomainData(dataArray);

    // Calculate a simple average to represent the current volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const value = Math.abs(dataArray[i] - 128); // Normalize to be positive
        sum += value;
    }
    const average = sum / dataArray.length;

    // Map the average value to a visual height
    const normalizedHeight = average / 128.0;
    
    // Push the new height to the waveform data array
    fullWaveformData.push(normalizedHeight);

    // Set canvas width to dynamically grow
    const newWidth = fullWaveformData.length * 2;
    canvas.width = Math.max(800, newWidth);
    
    // Clear the canvas and redraw the entire progressive line
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    // Use a fixed color instead of CSS variable
    canvasCtx.strokeStyle = '#007bff'; // or use getComputedStyle to get the CSS variable
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, canvas.height / 2);

    for (let i = 0; i < fullWaveformData.length; i++) {
        const x = i * 2;
        const y = canvas.height / 2 - (fullWaveformData[i] * canvas.height / 2);
        canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
    
    // Fix: Use querySelector for class name
    const scrollContainer = document.querySelector(".waveform-scroll-container");
    if (scrollContainer) {
        scrollContainer.scrollLeft = canvas.width;
    }
}