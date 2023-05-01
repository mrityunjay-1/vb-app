import { useEffect, useRef, useState } from "react";

import Logo from "./assets/images/logo.png";
import micIcon from "./assets/images/mic.gif";
import micInitial from "./assets/images/mic-initial.png";

import "./css/app.css";

import { v4 } from "uuid";

import socketio from "socket.io-client";

const socket = socketio(process.env.REACT_APP_SERVER_URL);

const App = () => {

    const audioContextRef = useRef(null);
    const isStreaming = useRef(false);

    const botAudioPlayRef = useRef(null);

    // user form to be filled before making web call
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    const [userSocketId, setUserSocketId] = useState("");

    const [room_joined, set_room_joined] = useState(false);

    const [imgSrc, setImgSrc] = useState();

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

            setImgSrc(false);
            audioContextRef.current.suspend();

            console.log("audio url: ", audio_url);

            if (!audio_url) throw new Error("Audio Url not received to playBotAudio function...");

            if (botAudioPlayRef.current) {
                botAudioPlayRef.current.pause();
            }

            const audio = new Audio(audio_url);

            audio.play();

            audio.onended = () => {
                audioContextRef.current.resume();
                setImgSrc(true);
            }

            botAudioPlayRef.current = audio;

        } catch (err) {
            console.log("Error: ", err);
        }
    }

    const startWebCallSession = () => {
        try {

            if (!name || !phone || !email) {
                alert("please enter all the asked details...");
                return;
            }

            set_room_joined(true);

            // audioContextRef.current.resume();
            // isStreaming.current = true;

            socket.emit("join_room", {
                userType: "user",
                roomName: v4(),
                name,
                phone,
                email
            });

            let botAudio = new Audio(`${process.env.REACT_APP_SERVER_URL}/airlines_new_airlines_greeting_msg_tts.mp3`);
            botAudio.play();

            botAudio.onended = () => {
                audioContextRef.current.resume();
                setImgSrc(true);
            }

        } catch (err) {
            console.log("Error: ", err);
        }
    }

    const cutCall = () => {
        audioContextRef.current.suspend();
        isStreaming.current = false;
        window.location.reload();
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

        socket.on("greeting", (data) => {
            console.log("Greeting from server with socket Id: ", data.socketId);
            setUserSocketId(data.socketId);
        })

        socket.on("vb-response", (data) => {
            // console.log("Data: ", data.audio_file_url);

            if (!data.audio_file_url) throw new Error("Audio location path not received...");

            playBotAudio(data.audio_file_url);

        });

    }, [])

    return (
        <>
            {
                room_joined ?

                    <>
                        <div style={{ width: "100vw", height: "100vh", background: "linear-gradient(to right bottom, lightgreen, purple)", display: "grid", placeItems: "center" }}>

                            <div style={{ width: "100%", display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
                                <h1 style={{ fontSize: "3rem" }}>Hello, {name}</h1>
                                <p style={{ fontSize: "1.5rem" }}>Email: {email}</p>
                                <p style={{ fontSize: "1.5rem" }}>Phone: {phone}</p>
                            </div>

                            {
                                userSocketId ?
                                    <>

                                        {
                                            imgSrc
                                                ?
                                                <>
                                                    {/* <p>Your socket id is : {userSocketId}</p> */}

                                                    <div style={{ width: "40%", display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
                                                        <img src={micIcon} style={{ width: "50%" }} alt="mic-icon" />
                                                        <br />
                                                        <br />
                                                        <h2 style={{ textAlign: "center" }}>Keep saying and wait for responses as you want, like a phone call...</h2>
                                                        <br />
                                                        <br />
                                                        <h1 id="dotter" style={{ textAlign: "center" }}>I am listening</h1>
                                                    </div>
                                                </>
                                                :
                                                <div style={{ width: "40%", display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
                                                    <img src={micInitial} style={{ width: "50%" }} alt="mic-initial-icon" />
                                                </div>

                                        }

                                    </>
                                    :
                                    <p>uh-oh! Looks like this app is not able to communicate with the backend server.</p>
                            }

                            <button className="cut-call-button" onClick={cutCall}> Disconnect &nbsp; ❌ </button>

                        </div>
                    </>

                    :

                    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#85BB65", display: "grid", placeItems: "center" }}>

                        <div className="form-container">

                            <div style={{ display: "grid", placeItems: "center" }}>
                                <img alt="logo" src={Logo} style={{ userSelect: "none", width: "70%", filter: "drop-shadow(0.1rem 0.5rem 0.3rem #233142)" }} />
                                <p style={{ userSelect: "none", fontSize: "1.2rem" }}>Crafted with  ❤️ At <a alt="oriserve" style={{ textDecoration: "none", color: "black" }} href="https://oriserve.com">Oriserve</a> Noida</p>
                            </div>

                            <br />
                            <br />

                            <div className="form-container-div">
                                <p className="form-p-tag">Name</p>
                                <input value={name} onChange={(e) => setName(e.target.value)} type="text" id="name" placeholder="Your Name" required />
                            </div>

                            <div className="form-container-div">
                                <p className="form-p-tag">Phone No</p>
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="text" id="name" placeholder="Your Phone No. Ex: 12345667890" required />
                            </div>

                            <div className="form-container-div">
                                <p className="form-p-tag">Email</p>
                                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" id="name" placeholder="Your Email Ex: abcd@example.com" required />
                            </div>

                            <br />
                            <br />

                            <button className="start-call-button" onClick={startWebCallSession} > 📞  &nbsp; Call  </button>

                        </div>
                    </div>
            }




        </>
    );
}

export default App;