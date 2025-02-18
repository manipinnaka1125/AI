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
    startCamera();
    return () => {
      // Stop the video stream when the component is unmounted
      const stream = videoRef.current?.srcObject;
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

    // Here, you can add cropping logic to focus on the area where the question is likely to appear
    const imageData = canvas.toDataURL("image/png");

    // Set the captured image to display below
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

    // Preprocess the image before sending to Tesseract.js
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
    // Basic filter to remove non-alphanumeric characters, extra spaces, and other garbage
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
    <div>
      <h1>OCR-AnswerBot</h1>
      <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Button to capture the frame */}
      <button onClick={captureFrame} disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Capture Snapshot"}
      </button>

      {/* Display captured image below */}
      {capturedImage && (
        <div>
          <h2>Captured Image:</h2>
          <img src={capturedImage} alt="Captured Question" style={{ width: "100%", maxWidth: "400px" }} />
        </div>
      )}

      <div>
        <h2>Recognized Text:</h2>
        <p>{recognizedText}</p>
      </div>
      <div>
        <h2>Answer:</h2>
        <p>{answer}</p>
      </div>
    </div>
  );
};

export default OCRAnswerBot;
