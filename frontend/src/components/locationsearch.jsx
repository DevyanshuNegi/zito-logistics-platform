import { useState } from 'react';

export default function LocationSearch({ value, onSelect, placeholder }) {

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const searchLocation = async (q) => {
    setQuery(q);

    if (q.length < 3) return;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}`
    );

    const data = await res.json();
    setResults(data);
  };

  return (
    <div style={{ position: 'relative' }}>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => searchLocation(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: 8
        }}
      />

      {results.length > 0 && (
        <div style={{
          position: 'absolute',
          background: '#111',
          width: '100%',
          maxHeight: 200,
          overflowY: 'auto',
          zIndex: 10
        }}>
          {results.map((r, i) => (
            <div
              key={i}
              style={{ padding: 10, cursor: 'pointer' }}
              onClick={() => {
                onSelect({
                  address: r.display_name,
                  lat: r.lat,
                  lng: r.lon
                });
                setResults([]);
              }}
            >
              {r.display_name}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}