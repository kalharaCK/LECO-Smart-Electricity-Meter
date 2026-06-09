import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000'); // Connect to backend

export const useMeterData = () => {
  const [dataHistory, setDataHistory] = useState([]);
  const [currentData, setCurrentData] = useState({ power: 0, voltage: 0, current: 0 });

  useEffect(() => {
    socket.on('meterData', (newData) => {
      setCurrentData(newData);
      // Keep only the last 15 readings for a clean minimalistic chart
      setDataHistory((prev) => {
        const updated = [...prev, newData];
        if (updated.length > 15) updated.shift();
        return updated;
      });
    });

    return () => socket.off('meterData');
  }, []);

  return { currentData, dataHistory };
};



