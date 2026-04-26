import { useState } from 'react';

export default function SwipeButton({ onSuccess, text = "Slide to Accept" }) {

  const [dragX, setDragX] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleDrag = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - rect.left;

    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    setDragX(x);

    if (x > rect.width * 0.8) {
      setCompleted(true);
      onSuccess();
    }
  };

  return (
    <div
      onMouseMove={(e) => !completed && handleDrag(e)}
      style={{
        position: 'relative',
        height: 50,
        background: '#1e293b',
        borderRadius: 30,
        overflow: 'hidden',
        cursor: 'pointer'
      }}
    >
      <div style={{
        position: 'absolute',
        left: dragX - 25,
        top: 5,
        width: 40,
        height: 40,
        background: '#22c55e',
        borderRadius: '50%',
        transition: completed ? '0.3s' : 'none'
      }} />

      <div style={{
        textAlign: 'center',
        lineHeight: '50px',
        color: '#fff',
        fontWeight: 'bold'
      }}>
        {completed ? "Accepted ✅" : text}
      </div>
    </div>
  );
}