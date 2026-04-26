import { useState } from 'react';
import { useSocketStatus } from '../contexts/SocketContext';

export default function ConnectionStatus() {
  const { connected, error } = useSocketStatus();
  const [showTooltip, setShowTooltip] = useState(false);

  const statusColor = connected ? '#22c55e' : '#ef4444';
  const statusText = connected ? 'Connected' : 'Disconnected';
  const statusIcon = connected ? '🟢' : '🔴';

  return (
    <div
      style={{
        position: 'relative',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Status Dot */}
      <div
        style={{
          width: 36,
          height: 36,
          background: '#181e2d',
          border: `1px solid rgba(255,255,255,0.07)`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: connected ? `0 0 8px ${statusColor}40` : 'none'
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
            animation: connected ? 'none' : 'pulse 2s infinite',
            opacity: connected ? 1 : 0.8
          }}
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: '#1a1f2e',
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#e8eaf2',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: statusColor, fontWeight: 600 }}>
              {statusIcon} {statusText}
            </span>
          </div>
          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
              {error}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#8892a4', marginTop: 4 }}>
            Real-time updates {connected ? '✓' : '✗'}
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 0.2; }
          }
        `}
      </style>
    </div>
  );
}
