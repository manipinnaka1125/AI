import React, { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import axios from "axios";

const OCRAnswerBot = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [answer, setAnswer] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // Prevent multiple OCR calls
  const [capturedImage, setCapturedImage] = useState(null); // To display captured image

  useEffect(() => {
    const videoElement = videoRef.current; // Capture the ref value in a variable
    startCamera();

    // Cleanup function
    return () => {
      const stream = videoElement?.srcObject;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  // Function to capture the current frame from the camera feed
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");
    setCapturedImage(imageData);

    processImage(canvas); // Process the captured image
  };

  // Preprocess and filter the image before passing it to Tesseract.js
  const preprocessImage = (canvas) => {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale to reduce noise and improve recognition
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg; // Set red, green, and blue channels to the average value
    }

    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  };

  // Process the image captured from the camera feed using Tesseract.js
  const processImage = async (canvas) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const preprocessedImage = preprocessImage(canvas);

    // Use Tesseract.js to recognize text from the image
    Tesseract.recognize(preprocessedImage, "eng", {
      logger: (m) => console.log(m), // Optional: show OCR progress
    }).then(({ data: { text } }) => {
      if (text.trim()) {
        const filteredText = filterText(text.trim());
        setRecognizedText(filteredText);
        fetchAnswer(filteredText); // Send filtered text to OpenAI
      } else {
        setRecognizedText("No text recognized.");
      }
      setIsProcessing(false);
    });
  };

  // Filter out unwanted characters or extra data from the recognized text
  const filterText = (text) => {
    const cleanText = text.replace(/[^a-zA-Z0-9\s?.,!]/g, '').trim();
    return cleanText;
  };

  // Fetch the answer from OpenAI's API based on the recognized text
  const fetchAnswer = async (question) => {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: question }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          },
        }
      );
      setAnswer(response.data.choices[0].message.content);
    } catch (error) {
      console.error("Error fetching answer:", error);
      setAnswer("Sorry, I couldn't fetch an answer.");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>OCR-AnswerBot</h1>
      <div style={styles.cameraContainer}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={styles.video}
        />
        <div style={styles.overlay}>Point the camera to any text!</div>
      </div>
      
      <button 
        onClick={captureFrame} 
        disabled={isProcessing} 
        style={styles.captureButton}
      >
        {isProcessing ? "Processing..." : "Capture Snapshot"}
      </button>

      {/* Display captured image below */}
      {capturedImage && (
        <div style={styles.capturedImageContainer}>
          <h3>Captured Image:</h3>
          <img
            src={capturedImage}
            alt="Captured Question"
            style={styles.capturedImage}
          />
        </div>
      )}

      <div style={styles.resultContainer}>
        <h3>Recognized Text:</h3>
        <p>{recognizedText}</p>
      </div>

      <div style={styles.resultContainer}>
        <h3>Answer:</h3>
        <p>{answer}</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    maxWidth: "600px",
    margin: "auto",
    height: "100vh",
    justifyContent: "center",
  },
  header: {
    fontSize: "2em",
    fontWeight: "bold",
    color: "#333",
    marginBottom: "20px",
  },
  cameraContainer: {
    position: "relative",
    width: "100%",
    height: "auto",
    marginBottom: "20px",
    borderRadius: "8px",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "auto",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
  },
  overlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "#fff",
    fontSize: "1.5em",
    textShadow: "2px 2px 10px rgba(0, 0, 0, 0.5)",
  },
  captureButton: {
    backgroundColor: "#4CAF50",
    color: "#fff",
    fontSize: "1.2em",
    padding: "15px 30px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    margin: "20px 0",
    transition: "background-color 0.3s",
  },
  capturedImageContainer: {
    textAlign: "center",
    marginTop: "20px",
  },
  capturedImage: {
    maxWidth: "100%",
    maxHeight: "300px",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  },
  resultContainer: {
    textAlign: "center",
    marginTop: "20px",
    padding: "10px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    width: "100%",
    maxWidth: "500px",
  },
};

export default OCRAnswerBot;
