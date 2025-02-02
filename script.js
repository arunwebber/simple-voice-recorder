let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let canvas;
let canvasCtx;
let recordedAudioUrl;
let audioElement;
let isRecording = false;
let isPaused = false;
let fullWaveformData = [];
let recordingStartTime;
let elapsedRecordingTime = 0; // In seconds
let stream;
let source;
let animationId;
let recordingTimeInterval;

document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("waveform");
    canvasCtx = canvas.getContext("2d");
    canvas.width = 800; // Initial width of canvas
    canvas.height = 150;

    document.getElementById("start").addEventListener("click", toggleRecording);
    document.getElementById("stop").addEventListener("click", stopRecording);
    document.getElementById("rerecord").addEventListener("click", resetRecorder);
    document.getElementById("stop").disabled = true;
});

async function toggleRecording() {
    if (isRecording) {
        if (!isPaused) {
            mediaRecorder.pause();
            if (audioElement) audioElement.pause();
            isPaused = true;
            document.getElementById("start").innerHTML = "&#x1F3A4;"; // Mic symbol
            cancelAnimationFrame(animationId);
            clearInterval(recordingTimeInterval); // Stop time update
        } else {
            mediaRecorder.resume();
            if (audioElement) audioElement.play();
            isPaused = false;
            document.getElementById("start").innerHTML = "&#9208;"; // Pause symbol
            drawRealTimeWaveform();
            startRecordingTime(); // Resume time tracking
        }
    } else {
        await startNewRecording();
        document.getElementById("start").innerHTML = "&#9208;"; // Pause symbol
        document.getElementById("stop").disabled = false;
    }
}

async function startNewRecording() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
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

    drawRealTimeWaveform();
    startRecordingTime(); // Start the recording timer

    mediaRecorder.ondataavailable = event => {
        if (!isPaused) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        isRecording = false;
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        recordedAudioUrl = URL.createObjectURL(audioBlob);

        audioElement = document.getElementById("audioPlayer");
        audioElement.src = recordedAudioUrl;
        audioElement.style.display = "block";
        audioElement.controls = true;

        document.getElementById("download").href = recordedAudioUrl;
        document.getElementById("download").download = "recording.wav";
        document.getElementById("download").style.display = "block";
        document.getElementById("rerecord").style.display = "block";
        document.getElementById("start").disabled = false;
        document.getElementById("stop").disabled = true;
        document.getElementById("start").innerHTML = "&#x1F3A4;"; // Mic symbol

        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        drawStaticWaveform(audioBuffer);

        clearInterval(recordingTimeInterval); // Stop the time update
    };

    mediaRecorder.start();
}

function startRecordingTime() {
    recordingTimeInterval = setInterval(() => {
        elapsedRecordingTime = (Date.now() - recordingStartTime) / 1000;
        document.getElementById("recording-length").textContent = `Recording length: ${elapsedRecordingTime.toFixed(3)} seconds`;  // Showing milliseconds
    }, 100); // Update every 100ms for more accurate time display
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
}

function drawRealTimeWaveform() {
    if (!isRecording || isPaused) return;

    animationId = requestAnimationFrame(drawRealTimeWaveform);

    analyser.getByteTimeDomainData(dataArray);
    fullWaveformData.push([...dataArray]);

    // Remove the oldest data if it exceeds the max length
    if (fullWaveformData.length > 5000) {
        fullWaveformData.shift(); // Remove the first (oldest) data point
    }

    // Adjust canvas width dynamically based on the waveform data length
    let newCanvasWidth = fullWaveformData.length * 2; // Adjust the width based on data length
    canvas.width = newCanvasWidth;

    let waveformContainer = document.querySelector('.waveform-scroll-container');
    if (waveformContainer) {
        setTimeout(() => {
            waveformContainer.scrollLeft = waveformContainer.scrollWidth;
        }, 0);
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.fillStyle = "black";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "lightblue";
    canvasCtx.beginPath();

    let step = Math.floor(dataArray.length / canvas.height);
    let x = 0;

    for (let i = 0; i < fullWaveformData.length; i++) {
        let chunk = fullWaveformData[i];
        let y = (chunk[0] / 128.0) * (canvas.height / 2);

        for (let j = 0; j < canvas.height; j += step) {
            y = (chunk[j] / 128.0) * (canvas.height / 2);

            if (j === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
        }
        x += 2;
    }

    canvasCtx.stroke();
}

function drawStaticWaveform(audioBuffer) {
    if (!audioBuffer) return;

    let rawData = audioBuffer.getChannelData(0);
    let waveformContainer = document.querySelector('.waveform-scroll-container');
    let waveformScrollCtx = canvas.getContext('2d');

    waveformScrollCtx.clearRect(0, 0, canvas.width, canvas.height);
    waveformScrollCtx.fillStyle = "black";
    waveformScrollCtx.fillRect(0, 0, canvas.width, canvas.height);

    let step = Math.floor(rawData.length / canvas.width);
    let amp = canvas.height / 2;

    waveformScrollCtx.lineWidth = 1;
    waveformScrollCtx.strokeStyle = "green";
    waveformScrollCtx.beginPath();

    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            let datum = rawData[i * step + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        waveformScrollCtx.moveTo(i, (1 + min) * amp);
        waveformScrollCtx.lineTo(i, (1 + max) * amp);
    }
    waveformScrollCtx.stroke();
}

function resetRecorder() {
    audioChunks = [];
    fullWaveformData = [];
    if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
        audioElement.style.display = "none";
        audioElement.controls = false;
    }
    document.getElementById("download").style.display = "none";
    document.getElementById("rerecord").style.display = "none";
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("start").innerHTML = "&#x1F3A4;"; // Mic symbol
    if (source) {
        source.disconnect(analyser);
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    clearInterval(recordingTimeInterval); // Clear the time update when resetting
    document.getElementById("recording-length").textContent = "Recording length: 0.000 seconds"; // Reset time display
}
