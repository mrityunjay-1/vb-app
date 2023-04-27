import { useEffect, useRef } from "react";

import socketio from "socket.io-client";

const socket = socketio("http://127.0.0.1:9000");

const App = () => {

    const audioContextRef = useRef(null);
    const isStreaming = useRef(false);

    const botAudioPlayRef = useRef(null);

    const startStreaming = async () => {
        try {

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const audioContext = new AudioContext({ sampleRate: 48000 });
            audioContextRef.current = audioContext;

            if (audioContext.state !== "suspended") {
                // console.log("not suspended");
                audioContext.suspend();
            }

            await audioContext.audioWorklet.addModule('myAudioWorklet.js');

            const sourceNode = audioContext.createMediaStreamSource(stream);

            console.log("buffer size (let's keep it default): ", 128);
            console.log("sampling rate: ", sourceNode.context.sampleRate);

            const myAudioWorklet = new AudioWorkletNode(audioContext, "myAudioWorklet");

            let i = 1, chunk = [];

            myAudioWorklet.port.onmessage = ({ data }) => {
                chunk = [...chunk, ...data[0][0]];

                if (i === 75) {
                    console.log(`${i} chunks sampled at 128 buffer size at sampling rate of ${sourceNode.context.sampleRate}`, chunk);

                    socket.emit("audioStream", { audioData: chunk });

                    chunk = [];
                    i = 1;
                    return;
                }

                i += 1;
            }

            sourceNode.connect(myAudioWorklet);
            myAudioWorklet.connect(audioContext.destination);

        } catch (err) {
            console.log("Error: ", err);
        }
    }

    const playBotAudio = (audio_url) => {
        try {

            if (!audio_url) throw new Error("Audio Url not received to playBotAudio function...");

            if (botAudioPlayRef.current) {
                botAudioPlayRef.current.pause();
            }

            const audio = new Audio(audio_url);

            audio.play();

            botAudioPlayRef.current = audio;

        } catch (err) {
            console.log("Error: ", err);
        }
    }

    // useEffect(() => {

    //     const socket = socketio("http://localhost:9000");

    //     (
    //         async () => {
    //             try {

    //                 const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    //                 stream.getAudioTracks().forEach((audioTracks) => {
    //                     audioTracks.stop();
    //                 });

    //                 const audioContext = new AudioContext();
    //                 audioContextRef.current = audioContext;

    //                 if (audioContext?.state === "suspended") {

    //                     console.log("suspended");

    //                     audioContext.resume();
    //                 }

    //                 // audioContext.suspend();

    //                 await audioContext.audioWorklet.addModule('myAudioWorklet.js');

    //                 const sourceNode = audioContext.createMediaStreamSource(stream);

    //                 // console.log("Source node: ", sourceNode);

    //                 const myAudioWorklet = new AudioWorkletNode(audioContext, "myAudioWorklet");

    //                 // myAudioWorklet.numberOfInputs = 1;
    //                 // myAudioWorklet.numberOfOutputs = 1;

    //                 myAudioWorklet.port.onmessage = ({ data }) => {
    //                     console.log("Input: ", data[0][0]);
    //                 }

    //                 sourceNode.connect(myAudioWorklet);
    //                 myAudioWorklet.connect(audioContext.destination);

    //                 // const scriptNode = audioContext.createScriptProcessor(512, 1, 1);

    //                 // scriptNode.addEventListener("audioprocess", (event) => {
    //                 //     // console.log("Event: ", event);

    //                 //     const inputData = event.inputBuffer.getChannelData(0);

    //                 //     console.log("input data: ", inputData);

    //                 //     socket.emit("audio", Object.values(inputData));
    //                 // });

    //                 // sourceNode.connect(scriptNode);
    //                 // scriptNode.connect(audioContext.destination);

    //             } catch (err) {
    //                 console.log("Error: ", err);
    //             }
    //         }
    //     )();

    // }, []);

    useEffect(() => {
        startStreaming();

        socket.on("vb-response", (data) => {
            console.log("Data: ", data.audio_file_url);

            if (!data.audio_file_url) throw new Error("Audio location path not received...");

            playBotAudio(data.audio_file_url);

        });

    }, [])

    return (
        <>
            {/* <p>Stripe payment integration</p>

            <stripe-pricing-table
                pricing-table-id="prctbl_1MysvQSAT8GypcQnlmycOTeO"
                publishable-key="pk_test_51MkNWySAT8GypcQnhAUiW99pJEhlmddjxyQOulyBbXo4JvK4wV7KT1pjFcZsTvmbXms7gDkImYPDwNXCfgaBfX2700jSL79IlV">
            </stripe-pricing-table> */}

            <button
                onClick={() => {
                    audioContextRef.current.resume();
                    isStreaming.current = true;
                }}
            >
                Start
            </button>

            <button
                onClick={() => {
                    audioContextRef.current.suspend();
                    isStreaming.current = false;
                }}
            >
                Stop
            </button>

        </>
    );
}

export default App;