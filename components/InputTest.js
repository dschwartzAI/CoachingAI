'use client'

import { useState, useRef, useEffect } from 'react';

export default function InputTest() {
  const [input, setInput] = useState('');
  const [focusCount, setFocusCount] = useState(0);
  const [blurCount, setBlurCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const inputRef = useRef(null);

  const addLog = (message) => {
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleFocus = (e) => {
      setFocusCount(prev => prev + 1);
      addLog('Input focused');
    };

    const handleBlur = (e) => {
      setBlurCount(prev => prev + 1);
      addLog('Input blurred');
    };

    const handleClick = (e) => {
      addLog('Input clicked');
    };

    const handleMouseDown = (e) => {
      addLog('Input mousedown');
    };

    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('click', handleClick);
    input.addEventListener('mousedown', handleMouseDown);

    return () => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('click', handleClick);
      input.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <div className="p-4 border rounded-lg bg-white max-w-md mx-auto mt-8">
      <h3 className="text-lg font-bold mb-4">Input Focus Test</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Test Input:</label>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Click here to type..."
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>Focus count: {focusCount}</div>
        <div>Blur count: {blurCount}</div>
      </div>

      <div className="mb-4">
        <button
          onClick={() => inputRef.current?.focus()}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
        >
          Focus Input
        </button>
        <button
          onClick={() => setLogs([])}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear Logs
        </button>
      </div>

      <div className="text-xs">
        <div className="font-medium mb-2">Event Log:</div>
        <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No events yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="text-gray-700">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 