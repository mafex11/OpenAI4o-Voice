import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { WavRenderer } from '../utils/wav_renderer';
import { doc, getDoc, setDoc } from "firebase/firestore"; // Firebase imports
import { db } from '../lib/firebaseConfig'; // Firebase Firestore DB

import './ConsolePage.scss';

export function ConsolePage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [speechInput, setSpeechInput] = useState<string>('');
  const [modelResponse, setModelResponse] = useState<string>('');
  const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
  const clientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: apiKey, dangerouslyAllowAPIKeyInBrowser: true }));

  // Firebase functions to fetch and save data
  const getUserData = async (docId: string) => {
    const docRef = doc(db, "users", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("Document data:", docSnap.data());
      return docSnap.data();
    } else {
      console.log("No such document!");
      return null;
    }
  };

  const saveUserData = async (docId: string, data: any) => {
    await setDoc(doc(db, "users", docId), data);
    console.log("Data saved successfully!");
  };

  // Speech handling
  const startConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    setIsConnected(true);
    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();

    client.sendUserMessageContent([{ type: 'input_text', text: 'Hello! I can now talk and interact with Firebase.' }]);

    wavRecorder.record((data) => client.appendInputAudio(data.mono));
  }, []);

  const stopConversation = useCallback(async () => {
    setIsConnected(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    await wavRecorder.end();
    await wavStreamPlayer.interrupt();
    client.disconnect();
  }, []);

  const fetchUserDataFromFirebase = async () => {
    const data = await getUserData("user_doc_id"); // Replace with dynamic ID
    if (data) {
      setModelResponse(`Fetched user data: ${JSON.stringify(data)}`);
    }
  };

  const handleSaveUserData = async () => {
    await saveUserData("user_doc_id", { speechInput, modelResponse }); // Save conversation
  };

  const startRecording = async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  const stopRecording = async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  useEffect(() => {
    const client = clientRef.current;

    client.on('conversation.updated', async ({ item, delta }: any) => {
      if (delta?.text) {
        setModelResponse(delta.text);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(item.formatted.audio, 24000, 24000);
        item.formatted.file = wavFile;
      }
    });

    return () => {
      client.reset();
    };
  }, []);

  return (
    <div className="speech-console">
      <h1>Model Speech Interface with Firebase</h1>
      <button onClick={isConnected ? stopConversation : startConversation}>
        {isConnected ? 'Stop Conversation' : 'Start Conversation'}
      </button>

      <button onClick={fetchUserDataFromFirebase}>Fetch User Data</button>
      <button onClick={handleSaveUserData}>Save Conversation to Firebase</button>

      <div className="model-response">
        <p>Model Response: {modelResponse}</p>
      </div>
    </div>
  );
}
