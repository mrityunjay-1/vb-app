
class MyAudioWorklet extends AudioWorkletProcessor {

    process(input, output, parameters) {

        // console.log("parameters: ", parameters);

        this.port.postMessage(input);

        return true;
    }

}

registerProcessor("myAudioWorklet", MyAudioWorklet);