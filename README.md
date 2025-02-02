<p align="center">
  <img src="https://raw.githubusercontent.com/arunwebber/simple-voice-recorder/refs/heads/master/images/icon_128.png" alt="Logo">
</p>
# Voice Recorder Application

## Description

This web-based **Voice Recorder** application allows users to record their audio, view a live waveform, track the recording duration in real-time (including milliseconds), and download the recording once completed. The application provides a user-friendly interface for easy recording, pausing, and re-recording. The waveform is generated in real-time, giving a visual representation of the sound being captured.

## Features

- **Start/Stop Recording**: Record audio directly from your microphone.
- **Real-time Waveform**: Visualize the audio waveform as you record.
- **Recording Duration**: Track the recording time in seconds and milliseconds.
- **Playback & Download**: Listen to the recorded audio and download it as a `.wav` file.
- **Pause & Resume**: Pause and resume the recording at any time.
- **Re-record**: Start a new recording after finishing or pausing the current one.
  
## Installation

1. **Clone the Repository**:
   Clone this repository to your local machine using Git:
   
   ```bash
   git clone https://github.com/your-username/voice-recorder-app.git
   ```

2. **Open in Browser**:
   Navigate to the project folder and open `index.html` in your preferred browser.

   Alternatively, you can host the app on a local or remote server for broader access.

3. **Dependencies**:
   This application uses:
   - **HTML5 Audio API**: For capturing and processing audio.
   - **Canvas API**: For displaying the waveform.
   - **MediaRecorder API**: For recording audio in the browser.

No server-side installation is required, as this application runs entirely in the browser.

## Usage

### Controls:
- **Start Recording**: Press the **🎤** button to begin recording.
- **Pause/Resume**: Press the **⏸️** button to pause the recording, and press it again to resume.
- **Stop Recording**: Press the **🛑** button to stop the recording.
- **Download**: Once the recording is stopped, click the **💾 Download** link to download your audio file.
- **Re-record**: Press the **↻** button to start a new recording.

### Display:
- **Recording Length**: The current recording duration is displayed in the format: `Recording length: 0.000 seconds`. This includes milliseconds for precise tracking.
- **Waveform**: A live waveform representation of the audio is shown on the canvas.

## Features in Development

- **More Advanced Audio Processing**: Future updates may include features like audio compression, noise reduction, and effects.
- **Waveform Customization**: Customize waveform colors and styles.
- **Multiple Format Support**: Support for recording in different audio formats (e.g., MP3, OGG).

## Contributing

Feel free to fork the project, contribute to the code, and open pull requests. If you encounter any bugs or want to suggest new features, please open an issue on the GitHub repository.

### Steps to Contribute:
1. Fork the repository.
2. Create a new branch for your feature or fix.
3. Make your changes.
4. Push your changes to your fork.
5. Create a pull request with a detailed description of your changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.