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
        this.rawRecordingsList = document.getElementById('rawRecordingsList');
        this.aiImprovedList = document.getElementById('aiImprovedList');
        this.recordings = {
            raw: this.loadRecordings('rawRecordings'),
            improved: this.loadRecordings('aiImprovedRecordings')
        };
        // No need for tab switching anymore
        this.renderRawRecordings();
        this.renderAIRecordings();
    }

    loadRecordings(storageKey) {
        try {
            const savedRecordings = StorageManager.getFromLocalStorage(storageKey);
            return savedRecordings ? JSON.parse(savedRecordings) : [];
        } catch (e) {
            console.error(`Failed to parse ${storageKey} from localStorage:`, e);
            return [];
        }
    }

    saveRecordings(type = 'raw') {
        const storageKey = type === 'raw' ? 'rawRecordings' : 'aiImprovedRecordings';
        StorageManager.saveToLocalStorage(storageKey, JSON.stringify(this.recordings[type]));
    }

    addRecording(blob, duration, type = 'raw') {
        const reader = new FileReader();
        reader.onload = () => {
            const newRecording = {
                id: `rec-${Date.now()}`,
                name: `Recording ${this.recordings[type].length + 1}`,
                dataUrl: reader.result,
                duration: this.formatTime(duration),
                timestamp: Date.now(),
                type: type
            };
            this.recordings[type].unshift(newRecording);
            this.saveRecordings(type);
            
            if (type === 'raw') {
                this.renderRawRecordings();
            } else {
                this.renderAIRecordings();
            }
        };
        reader.readAsDataURL(blob);
    }

    deleteRecording(id, type) {
        this.recordings[type] = this.recordings[type].filter(rec => rec.id !== id);
        this.saveRecordings(type);
        
        if (type === 'raw') {
            this.renderRawRecordings();
        } else {
            this.renderAIRecordings();
        }
    }

    renderRawRecordings() {
        this.rawRecordingsList.innerHTML = '';
        const recordings = this.recordings.raw;

        if (recordings.length === 0) {
            this.rawRecordingsList.innerHTML = `
                <div class="empty-state">
                    <p>No recordings yet</p>
                    <small>Click the microphone to start recording</small>
                </div>
            `;
            return;
        }

        // Group recordings by date
        const recordingsByDate = recordings.reduce((groups, rec) => {
            const date = new Date(rec.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(rec);
            return groups;
        }, {});

        // Render each date group
        for (const date in recordingsByDate) {
            const dateHeader = document.createElement('h3');
            dateHeader.textContent = date;
            this.rawRecordingsList.appendChild(dateHeader);

            recordingsByDate[date].forEach(rec => {
                const item = document.createElement('div');
                item.className = 'recording-item';
                item.dataset.id = rec.id;
                item.dataset.type = 'raw';
                item.innerHTML = `
                    <div class="name">
                      <span class="title">${rec.name}</span>
                      <span class="duration">(${rec.duration})</span>
                    </div>
                    <div class="controls">
                        <button class="play-btn" data-id="${rec.id}" data-type="raw">&#9658;</button>
                        <button class="download-btn" data-id="${rec.id}" data-type="raw">&#x1F4BE;</button>
                        <button class="improve-btn" data-id="${rec.id}" data-type="raw" title="Improve with AI">✨</button>
                        <button class="delete-btn" data-id="${rec.id}" data-type="raw">&#x1F5D1;</button>
                    </div>
                `;
                this.rawRecordingsList.appendChild(item);
            });
        }
        
        this.setupEventListeners();
    }

    renderAIRecordings() {
        this.aiImprovedList.innerHTML = '';
        const recordings = this.recordings.improved;

        if (recordings.length === 0) {
            this.aiImprovedList.innerHTML = `
                <div class="empty-state">
                    <p>No AI improved recordings yet</p>
                    <small>Raw recordings can be improved using AI</small>
                </div>
            `;
            return;
        }

        // Group recordings by date
        const recordingsByDate = recordings.reduce((groups, rec) => {
            const date = new Date(rec.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(rec);
            return groups;
        }, {});

        // Render each date group
        for (const date in recordingsByDate) {
            const dateHeader = document.createElement('h3');
            dateHeader.textContent = date;
            this.aiImprovedList.appendChild(dateHeader);

            recordingsByDate[date].forEach(rec => {
                const item = document.createElement('div');
                item.className = 'recording-item';
                item.dataset.id = rec.id;
                item.dataset.type = 'improved';
                item.innerHTML = `
                    <div class="name">
                      <span class="title">${rec.name}</span>
                      <span class="duration">(${rec.duration})</span>
                    </div>
                    <div class="controls">
                        <button class="play-btn" data-id="${rec.id}" data-type="improved">&#9658;</button>
                        <button class="download-btn" data-id="${rec.id}" data-type="improved">&#x1F4BE;</button>
                        <button class="delete-btn" data-id="${rec.id}" data-type="improved">&#x1F5D1;</button>
                    </div>
                `;
                this.aiImprovedList.appendChild(item);
            });
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Play buttons
        document.querySelectorAll('.play-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                this.playRecording(id, type);
            });
        });

        // Download buttons
        document.querySelectorAll('.download-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                this.downloadRecording(id, type);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                this.deleteRecording(id, type);
            });
        });

        // Improve buttons (only on raw recordings)
        document.querySelectorAll('.improve-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                this.improveRecording(id, type);
            });
        });

        // Double-click to rename
        document.querySelectorAll('.recording-item .title').forEach(titleSpan => {
            titleSpan.addEventListener('dblclick', (e) => {
                const recordingItem = e.target.closest('.recording-item');
                const type = recordingItem.dataset.type;
                this.startRename(e.target, type);
            });
        });
    }

    playRecording(id, type) {
        const recording = this.recordings[type].find(rec => rec.id === id);
        if (recording) {
            const audio = new Audio(recording.dataUrl);
            audio.play();
        }
    }

    downloadRecording(id, type) {
        const recording = this.recordings[type].find(rec => rec.id === id);
        if (recording) {
            const link = document.createElement('a');
            link.href = recording.dataUrl;
            link.download = `${recording.name}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    improveRecording(id, type) {
        const recording = this.recordings[type].find(rec => rec.id === id);
        if (recording) {
            // For now, just show an alert. In the future, this will process the audio with AI
            alert(`AI improvement feature coming soon for "${recording.name}"!`);
            
            // Example of how you might copy to improved recordings later:
            // const improvedRecording = {
            //     ...recording,
            //     id: `imp-${Date.now()}`,
            //     name: `${recording.name} (AI Enhanced)`,
            //     originalId: recording.id,
            //     improvedAt: Date.now()
            // };
            // this.recordings.improved.unshift(improvedRecording);
            // this.saveRecordings('improved');
            // this.renderAIRecordings();
        }
    }

    startRename(titleElement, type) {
        const id = titleElement.closest('.recording-item').dataset.id;
        const recording = this.recordings[type].find(rec => rec.id === id);
        const currentName = recording.name;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'rename-input';
        
        titleElement.style.display = 'none';
        titleElement.parentNode.insertBefore(input, titleElement);
    
        input.focus();
        input.select();
    
        const finishRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                recording.name = newName;
                this.saveRecordings(type);
            }
            if (type === 'raw') {
                this.renderRawRecordings();
            } else {
                this.renderAIRecordings();
            }
        };
    
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishRename();
            }
        });
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
    
    // Settings button event listener
    document.getElementById("settingsButton").addEventListener("click", () => alert("Settings button clicked!"));
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