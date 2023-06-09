import { useEffect, useRef, useState } from "react";

import Logo from "./assets/images/logo.png";
import micIcon from "./assets/images/mic.gif";
import micInitial from "./assets/images/mic-initial.png";
import edtechImg from "./assets/images/edtech.jpg";
import tourismImg from "./assets/images/tourism.jpg";
import testImg from "./assets/images/tesla.png";

import "./css/app.css";

import { v4 } from "uuid";

import socketio from "socket.io-client";

import { GREETING_MESSAGES } from "./config/constants";

const socket = socketio(process.env.REACT_APP_SERVER_URL, {
    autoConnect: false
});

const App = () => {

    const audioContextRef = useRef(null);
    const isStreaming = useRef(false);

    // eslint-disable-next-line
    const [botId, _setBotId] = useState(new URLSearchParams(window?.location?.search).get("botId"));
    // const [isBotOpen, _setIsbbotOpen] = useState(new URLSearchParams(window?.location?.search).get("botId"));

    // eslint-disable-next-line
    const [botName, _setBotName] = useState(new URLSearchParams(window?.location?.search).get("botName") ?? "general");

    console.log("botId: ", botId);

    console.log("bot name: ", botName)

    const botAudioPlayRef = useRef(null);

    // user form to be filled before making web call
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    const [userSocketId, setUserSocketId] = useState("");
    const [room_joined, set_room_joined] = useState(false);
    const [imgSrc, setImgSrc] = useState();

    const [showBotContainer, setShowBotContainer] = useState(Boolean(new URLSearchParams(window?.location?.search).get("isBotOpen")) ?? false);

    const container = useRef(null);

    // screen wake Lock ref
    const wakeLockRef = useRef(null);

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

                    // will do check in future if there is no tenant id found then there should be no data transmission to the servers

                    socket.emit("audioStream", { audioData: chunk, botId, botName });

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

            audio_url = audio_url + "?time=" + new Date().getTime();

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

            if (phone && phone.length !== 10) {
                return alert("please enter valid phone number...");
            }

            console.log("email: ", email);

            if (email && !(email.includes("@") && email.includes("."))) {
                return alert("please enter valid email address...");
            }

            // Acquiring Screen Lock
            acquireScreenWakeLock();

            // Connecting with socket
            socket.connect();

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

            // let botAudio = new Audio(`${process.env.REACT_APP_SERVER_URL}/tring_tring.mp3`);
            // botAudio.play();

            // botAudio.onended = () => {
            //     audioContextRef.current.resume();
            //     setImgSrc(true);
            playBotAudio(`${process.env.REACT_APP_SERVER_URL}/${GREETING_MESSAGES[botName]}`);
            // }

        } catch (err) {
            console.log("Error: ", err);
        }
    }

    const acquireScreenWakeLock = () => {
        try {

            if ("wakeLock" in navigator) {

                navigator.wakeLock.request("screen")
                    .then((wakeLock) => {
                        console.log("Screen wake Locked while having the conversation...");
                        wakeLockRef.current = wakeLock;
                    })
                    .catch(() => {
                        console.log("Screen wake Locking failed...")
                    })

            } else {
                console.log("Wake Lock feature is not available in this browser...");
            }

        } catch (err) {
            console.log("Error in acquireScreenWakeLock function...");
        }
    }

    const releaseScreenWakeLock = () => {
        try {
            if (wakeLockRef.current) {
                wakeLockRef.current.release()
                    .then(() => {
                        console.log("Screen wake lock released successfully...");
                    })
                    .catch(() => {
                        console.log("Screen wake lock release failed...");
                    })
            }
        } catch (err) {
            console.log("Error in releaseScreenWakeLock Function...");
        }
    }

    const cutCall = () => {

        if (audioContextRef.current) {
            audioContextRef.current.suspend();
        }

        isStreaming.current = false;

        if (botAudioPlayRef?.current) {
            botAudioPlayRef.current.pause();
        }

        // releasing screen wake lock
        releaseScreenWakeLock();

        setUserSocketId("");
        set_room_joined(false);
        socket.disconnect();

        // eslint-disable-next-line
        history.back();

        // promptToGiveFeedback();

        // setShowBotContainer(false);
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

        // getting tenant ID from query search params
        // console.log("window?.location?.search MK : ", window?.location?.search);
        // const params = new URLSearchParams(window?.location?.search);
        // const tid = params.get("botId"); // tid : botId

        // if (tid) {
        //     console.log("tid : ", tid);
        //     setbotId(tid);
        // }

        // const messagelistener = window.addEventListener("message", (event) => {

        //     console.log("Event: ", event);

        //     if (event && event.data && event.data.botId) {

        //         if (!botId) {
        //             setbotId(event.data.botId);
        //         }
        //     }
        // });

        socket.on("greeting", (data) => {
            console.log("Greeting from server with socket Id: ", data.socketId);
            setUserSocketId(data.socketId);
        })

        socket.on("vb-response", (data) => {
            // console.log("Data: ", data.audio_file_url);

            if (!data.audio_file_url) throw new Error("Audio location path not received...");

            playBotAudio(data.audio_file_url);

        });

        // return () => {
        //     messagelistener()
        // }
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        // const windowHeight = window.innerHeight;
        // container.current.height = windowHeight + "px";

        return () => {
            releaseScreenWakeLock();
        }
    }, []);

    return (
        <>

            {
                botName !== "general" ?

                    <div ref={container} className="container" id="container">

                        {
                            showBotContainer ?
                                <div className="bot-container">
                                    {
                                        room_joined ?

                                            <>
                                                <div style={{ width: "100%", height: "100%", flex: 1, background: "linear-gradient(to right bottom, lightgreen, purple)", display: "grid", placeItems: "center" }}>

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

                                            <div style={{ width: "100%", height: "100%", flex: 1, display: "grid", placeItems: "center" }}>

                                                <div className="form-container">

                                                    <div style={{ display: "grid", placeItems: "center" }}>
                                                        <img alt="logo" src={Logo} style={{ userSelect: "none", width: "70%", filter: "drop-shadow(0.1rem 0.5rem 0.3rem #233142)" }} />
                                                        <p style={{ userSelect: "none", fontSize: "1.2rem" }}>Crafted with  ❤️ At <a rel="noreferrer" target="_blank" alt="oriserve" style={{ textDecoration: "none", color: "black" }} href="https://oriserve.com">Oriserve</a> Noida</p>
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

                                                    <button className="start-call-button" onClick={startWebCallSession} > 📞  &nbsp; Start Call  </button>

                                                </div>
                                            </div>
                                    }
                                </div>
                                :
                                <div></div>
                        }

                        <div className="bot-trigger-button-container" onClick={() => setShowBotContainer(!showBotContainer)}>
                            <button className="bot-trigger-button">{showBotContainer ? "❌" : "📞"}</button>
                        </div>

                    </div>

                    :

                    <div className="botCardContainers">

                        <div style={{ padding: "0 2% 2% 2%", textAlign: "center", fontSize: "2.8rem", color: "grey" }}>
                            <p>Welcome to TalkFusion</p>
                        </div>

                        <div className="bots">
                            <div>

                                <div>
                                    <img src={edtechImg} className="bot-images" alt="edtech" />

                                </div>

                                <div style={{ margin: "1rem 0" }}>
                                    <p style={{ fontSize: "1.6rem" }}>EdTech, or Education Technology, refers to the integration of technology into educational practices to enhance teaching and learning experiences. It encompasses a wide range of tools and technologies, such as computers, tablets, online platforms, educational apps, and more.</p>
                                </div>

                                <div style={{ width: "100%", flex: 1, marginTop: "2rem" }}>
                                    <a className="anchor-button" href={`${process.env.REACT_APP_OWN_URL}?isBotOpen=true&botName=edtech`}> Call Us </a>
                                </div>

                            </div>

                            <div>

                                <div>
                                    <img src={tourismImg} className="bot-images" alt="edtech" style={{ width: "100%" }} />

                                </div>

                                <div style={{ margin: "1rem 0" }}>
                                    <p style={{ fontSize: "1.6rem" }}>Travel is the only thing you buy that makes you richer”. We completely swear by this and believe in fulfilling travel dreams that make you invariably rich by the day. We have been selling beautiful experiences for years through our state-of-the-art designed holiday packages and other essential travel services. We inspire our customers to live a rich life, full of unforgettable travel experiences</p>
                                </div>

                                <div style={{ width: "100%", flex: 1, marginTop: "2rem" }}>
                                    <a dis className="anchor-button" href={`${process.env.REACT_APP_OWN_URL}?isBotOpen=true&botName=tourism`}> Call Us </a>
                                </div>

                            </div>

                            <div>

                                <div>
                                    <img src={testImg} className="bot-images" alt="edtech" style={{ width: "100%" }} />

                                </div>

                                <div style={{ margin: "1rem 0" }}>
                                    <p style={{ fontSize: "1.6rem" }}>Tesla is an electric vehicle manufacturer and clean energy company led by billionaire Elon Musk. Tesla is also the biggest seller of plug-in electric vehicles; its Model 3 sedan, which debuted in 2017, is the world's all-time bestselling plug-in EV, having sold more than 800,000 before the start of 2021.</p>
                                </div>

                                <div style={{ width: "100%", flex: 1, marginTop: "2rem" }}>
                                    <a className="anchor-button" href={`${process.env.REACT_APP_OWN_URL}?isBotOpen=true&botName=tesla`}> Call Us </a>
                                </div>

                            </div>

                        </div>
                    </div>

            }

        </>
    );
}

export default App;