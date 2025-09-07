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
// Add this class before the RecordingLibrary class
class AudioPlayer {
    constructor() {
        this.currentAudio = null;
        this.currentRecordingId = null;
        this.isPlaying = false;
        this.progressInterval = null; // For smooth progress updates
        
        // Player elements
        this.playerContainer = document.getElementById('audioPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.seekBar = document.getElementById('seekBar');
        this.currentTimeSpan = document.getElementById('currentTime');
        this.durationSpan = document.getElementById('duration');
        this.progressFill = document.getElementById('progressFill');
        this.nowPlayingTitle = document.getElementById('nowPlayingTitle');
        this.closeBtn = document.getElementById('closePlayer');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Play/Pause button
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        
        // Inside setupEventListeners()
// Inside setupEventListeners()
        this.seekBar.addEventListener('input', (e) => {
            if (this.currentAudio) {
                const percent = e.target.value;
                
                // Use actual duration if available, otherwise use fallback
                const duration = (this.currentAudio.duration && isFinite(this.currentAudio.duration) && this.currentAudio.duration > 0) 
                    ? this.currentAudio.duration 
                    : this.recordingDurationFallback;
                
                if (duration > 0) {
                    const time = (percent / 100) * duration;
                    
                    // Only set currentTime if the audio is loaded enough
                    if (this.currentAudio.readyState >= 2) { // HAVE_CURRENT_DATA or better
                        this.currentAudio.currentTime = time;
                    } else {
                        // Store the desired time and set it when ready
                        this.pendingSeekTime = time;
                        
                        // Add a one-time listener to seek when ready
                        this.currentAudio.addEventListener('canplay', () => {
                            if (this.pendingSeekTime !== undefined) {
                                this.currentAudio.currentTime = this.pendingSeekTime;
                                this.pendingSeekTime = undefined;
                            }
                        }, { once: true });
                    }
                    
                    // Update UI immediately regardless
                    this.progressFill.style.width = percent + '%';
                    this.currentTimeSpan.textContent = this.formatTime(time);
                }
            }
        });
        
        // Close button
        this.closeBtn.addEventListener('click', () => this.stop());
        
        // Progress bar click
        // Progress bar click
        this.progressFill.parentElement.addEventListener('click', (e) => {
            if (this.currentAudio) {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                
                // Use actual duration if available, otherwise use fallback
                const duration = (this.currentAudio.duration && isFinite(this.currentAudio.duration) && this.currentAudio.duration > 0) 
                    ? this.currentAudio.duration 
                    : this.recordingDurationFallback;
                
                if (duration > 0) {
                    const newTime = percent * duration;
                    
                    if (this.currentAudio.readyState >= 2) {
                        this.currentAudio.currentTime = newTime;
                    } else {
                        this.pendingSeekTime = newTime;
                        this.currentAudio.addEventListener('canplay', () => {
                            if (this.pendingSeekTime !== undefined) {
                                this.currentAudio.currentTime = this.pendingSeekTime;
                                this.pendingSeekTime = undefined;
                            }
                        }, { once: true });
                    }
                    
                    // Update UI immediately
                    this.seekBar.value = percent * 100;
                    this.progressFill.style.width = (percent * 100) + '%';
                    this.currentTimeSpan.textContent = this.formatTime(newTime);
                }
            }
        });
    }
    
    play(recording, recordingElement) {
        // Stop current audio if playing
        if (this.currentAudio) {
            this.stop();
        }
        
        // Remove playing class from all recordings
        document.querySelectorAll('.recording-item').forEach(item => {
            item.classList.remove('playing');
        });
        
        // Create new audio element
        this.currentAudio = new Audio(recording.dataUrl);
        this.currentRecordingId = recording.id;
        
        // Store the fallback duration immediately
        this.recordingDurationFallback = recording.durationSeconds || 0;
        
        // Add playing class to current recording
        if (recordingElement) {
            recordingElement.classList.add('playing');
        }
        
        // Set initial values using the stored duration
        this.currentTimeSpan.textContent = '0:00';
        this.durationSpan.textContent = this.formatTime(this.recordingDurationFallback);
        this.seekBar.value = 0;
        this.seekBar.max = 100; // Set max immediately
        this.progressFill.style.width = '0%';
        
        // Enable seeking immediately
        this.seekBar.disabled = false;
        
        // Setup audio event listeners
        this.currentAudio.addEventListener('loadedmetadata', () => {
            // Update with actual duration when available
            const duration = this.currentAudio.duration;
            if (isFinite(duration) && duration > 0) {
                this.durationSpan.textContent = this.formatTime(duration);
                // Update the fallback duration with the actual duration
                this.recordingDurationFallback = duration;
            }
        });
        
        // Add durationchange event listener
        this.currentAudio.addEventListener('durationchange', () => {
            if (this.currentAudio && this.currentAudio.duration && isFinite(this.currentAudio.duration) && this.currentAudio.duration > 0) {
                this.durationSpan.textContent = this.formatTime(this.currentAudio.duration);
                this.recordingDurationFallback = this.currentAudio.duration;
            }
        });
        
        this.currentAudio.addEventListener('ended', () => {
            this.stop();
        });
        
        // Handle loading errors
        this.currentAudio.addEventListener('error', (e) => {
            console.error('Audio loading error:', e);
            this.durationSpan.textContent = 'Error';
            this.stop();
        });
        
        // Handle audio canplay event
        this.currentAudio.addEventListener('canplay', () => {
            // Audio is ready to play
            if (this.currentAudio.duration && isFinite(this.currentAudio.duration) && this.currentAudio.duration > 0) {
                this.durationSpan.textContent = this.formatTime(this.currentAudio.duration);
                this.recordingDurationFallback = this.currentAudio.duration;
            }
            
            // Apply pending seek if exists
            if (this.pendingSeekTime !== undefined) {
                this.currentAudio.currentTime = this.pendingSeekTime;
                this.pendingSeekTime = undefined;
            }
        });
        
        // Handle loadeddata event as additional fallback
        this.currentAudio.addEventListener('loadeddata', () => {
            if (this.currentAudio && this.currentAudio.duration && isFinite(this.currentAudio.duration) && this.currentAudio.duration > 0) {
                this.durationSpan.textContent = this.formatTime(this.currentAudio.duration);
                this.recordingDurationFallback = this.currentAudio.duration;
            }
        });
        
        // No longer need the setTimeout fallback since we're using stored duration
        
        // Update UI
        this.nowPlayingTitle.textContent = `Now Playing: ${recording.name}`;
        this.playerContainer.style.display = 'block';
        this.playPauseBtn.textContent = '⏸️';
        this.isPlaying = true;
        
        // Start playing
        this.currentAudio.play().then(() => {
            // Start smooth progress updates
            this.startProgressInterval();
        }).catch(err => {
            console.error('Playback error:', err);
            // Try to reload and play again
            this.currentAudio.load();
            setTimeout(() => {
                if (this.currentAudio) {
                    this.currentAudio.play().then(() => {
                        this.startProgressInterval();
                    }).catch(e => {
                        console.error('Second playback attempt failed:', e);
                        this.stop();
                    });
                }
            }, 100);
        });
    }
    
    togglePlayPause() {
        if (!this.currentAudio) return;
        
        if (this.isPlaying) {
            this.currentAudio.pause();
            this.playPauseBtn.textContent = '▶️';
            this.isPlaying = false;
            this.stopProgressInterval(); // Stop interval when paused
        } else {
            this.currentAudio.play()
                .then(() => {
                    this.playPauseBtn.textContent = '⏸️';
                    this.isPlaying = true;
                    this.startProgressInterval(); // Start interval when playing
                })
                .catch(err => {
                    console.error('Play error:', err);
                });
        }
    }
    
    startProgressInterval() {
        this.stopProgressInterval(); // Clear any existing interval
        
        // Update progress 30 times per second for smooth animation
        this.progressInterval = setInterval(() => {
            if (this.currentAudio && !this.currentAudio.paused) {
                this.updateProgress();
            }
        }, 33); // 33ms = ~30fps
    }
    
    stopProgressInterval() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    
    stop() {
        this.stopProgressInterval(); // Stop the progress interval
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            
            // Remove all event listeners
            this.currentAudio.removeEventListener('ended', () => this.stop());
            this.currentAudio.removeEventListener('loadedmetadata', () => {});
            this.currentAudio.removeEventListener('error', () => {});
            this.currentAudio.removeEventListener('canplay', () => {});
            this.currentAudio.removeEventListener('durationchange', () => {});
            this.currentAudio.removeEventListener('loadeddata', () => {});
            
            this.currentAudio = null;
        }
        
        // Reset UI
        this.playerContainer.style.display = 'none';
        this.playPauseBtn.textContent = '▶️';
        this.isPlaying = false;
        this.seekBar.value = 0;
        this.progressFill.style.width = '0%';
        this.currentTimeSpan.textContent = '0:00';
        this.durationSpan.textContent = '0:00';
        
        // Remove playing class
        document.querySelectorAll('.recording-item').forEach(item => {
            item.classList.remove('playing');
        });
        
        this.currentRecordingId = null;
    }
    
    updateProgress() {
        if (!this.currentAudio) return;

        const currentTime = this.currentAudio.currentTime || 0;

        // Use actual duration if available, otherwise fallback
        let duration = (isFinite(this.currentAudio.duration) && this.currentAudio.duration > 0)
            ? this.currentAudio.duration
            : (this.recordingDurationFallback || 1);

        const progress = (currentTime / duration) * 100;
        const safeProgress = Math.max(0, Math.min(100, progress));

        this.seekBar.value = safeProgress;
        this.progressFill.style.width = safeProgress + '%';
        this.progressFill.parentElement.style.setProperty('--progress-position', safeProgress + '%');

        this.currentTimeSpan.textContent = this.formatTime(currentTime);

        if (duration && this.durationSpan.textContent === 'Loading...') {
            this.durationSpan.textContent = this.formatTime(duration);
        }
    }


    
    formatTime(seconds) {
        if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
}

class RecordingLibrary {
    constructor() {
        this.recordingsList = document.getElementById('recordingsList');
        this.recordings = this.loadRecordings();
        this.renderRecordings();
    }

    loadRecordings() {
        try {
            const savedRecordings = StorageManager.getFromLocalStorage('recordings');
            return savedRecordings ? JSON.parse(savedRecordings) : [];
        } catch (e) {
            console.error('Failed to parse recordings from localStorage:', e);
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
                duration: this.formatTime(duration),
                durationSeconds: duration,
                timestamp: Date.now()
            };
            this.recordings.unshift(newRecording);
            this.saveRecordings();
            this.renderRecordings();
        };
        reader.readAsDataURL(blob);
    }

    deleteRecording(id) {
        this.recordings = this.recordings.filter(rec => rec.id !== id);
        this.saveRecordings();
        this.renderRecordings();
    }

    renderRecordings() {
        this.recordingsList.innerHTML = '';

        if (this.recordings.length === 0) {
            this.recordingsList.innerHTML = `
                <div class="empty-state">
                    <p>No recordings yet</p>
                    <small>Click the microphone to start recording</small>
                </div>
            `;
            return;
        }

        // Group recordings by date
        const recordingsByDate = this.recordings.reduce((groups, rec) => {
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
            this.recordingsList.appendChild(dateHeader);

            recordingsByDate[date].forEach(rec => {
                const item = document.createElement('div');
                item.className = 'recording-item';
                item.dataset.id = rec.id;
                item.innerHTML = `
                    <div class="name">
                      <span class="title">${rec.name}</span>
                      <span class="duration">(${rec.duration})</span>
                    </div>
                    <div class="controls">
                        <button class="play-btn" data-id="${rec.id}">&#9658;</button>
                        <button class="download-btn" data-id="${rec.id}">&#x1F4BE;</button>
                        <button class="delete-btn" data-id="${rec.id}">&#x1F5D1;</button>
                    </div>
                `;
                this.recordingsList.appendChild(item);
            });
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Play buttons
        document.querySelectorAll('.play-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.playRecording(id);
            });
        });

        // Download buttons
        document.querySelectorAll('.download-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.downloadRecording(id);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.deleteRecording(id);
            });
        });

        // Double-click to rename
        document.querySelectorAll('.recording-item .title').forEach(titleSpan => {
            titleSpan.addEventListener('dblclick', (e) => {
                this.startRename(e.target);
            });
        });
    }

    playRecording(id) {
        const recording = this.recordings.find(rec => rec.id === id);
        if (recording) {
            const recordingElement = document.querySelector(`.recording-item[data-id="${id}"]`);
            audioPlayer.play(recording, recordingElement);
        }
    }

    downloadRecording(id) {
        const recording = this.recordings.find(rec => rec.id === id);
        if (recording) {
            const link = document.createElement('a');
            link.href = recording.dataUrl;
            // Determine file extension based on MIME type
            let extension = 'webm'; // default
            if (recording.dataUrl.includes('audio/ogg')) {
                extension = 'ogg';
            } else if (recording.dataUrl.includes('audio/mp4')) {
                extension = 'mp4';
            }
            link.download = `${recording.name}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    startRename(titleElement) {
        const id = titleElement.closest('.recording-item').dataset.id;
        const recording = this.recordings.find(rec => rec.id === id);
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
                this.saveRecordings();
            }
            this.renderRecordings();
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
let audioPlayer; 

document.addEventListener("DOMContentLoaded", () => {
    new DarkModeManager("#darkModeToggle");
    audioPlayer = new AudioPlayer();
    library = new RecordingLibrary();

    canvas = document.getElementById("waveform");
    canvasCtx = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 150;

    document.getElementById("start").addEventListener("click", toggleRecording);
    document.getElementById("stop").addEventListener("click", stopRecording);
    document.getElementById("rerecord").addEventListener("click", resetRecorder);
    document.getElementById("stop").disabled = true;
    
    // Remove the settings button listener since we're removing it
    // document.getElementById("settingsButton").addEventListener("click", () => alert("Settings button clicked!"));
    
    document.addEventListener('keydown', (e) => {
        if (audioPlayer.currentAudio && e.target.tagName !== 'INPUT') {
            if (e.code === 'Space') {
                e.preventDefault();
                audioPlayer.togglePlayPause();
            } else if (e.code === 'ArrowRight') {
                audioPlayer.currentAudio.currentTime += 5;
            } else if (e.code === 'ArrowLeft') {
                audioPlayer.currentAudio.currentTime -= 5;
            }
        }
    });
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
        
        // Determine the best supported MIME type
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }
        
        // Store mimeType in a variable accessible to the onstop handler
        const recordingMimeType = mimeType;
        
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        console.log("MediaRecorder created with mimeType:", mimeType);
        
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
            const audioBlob = new Blob(audioChunks, { type: recordingMimeType });
            const duration = (Date.now() - recordingStartTime) / 1000;
            library.addRecording(audioBlob, duration); // Removed the 'type' parameter
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
        document.getElementById("recording-length").textContent = `Recording length: ${formatTimeDisplay(elapsedRecordingTime)}`;
    }, 100);
}

// Add this new function for proper time formatting
function formatTimeDisplay(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 100); // Changed to show 2 decimal places
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
        return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
    } else {
        return `${secs}.${millis.toString().padStart(2, '0')} seconds`;
    }
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