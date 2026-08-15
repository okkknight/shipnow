import { useMemo } from 'react';

interface Star {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
}

export default function StarField() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${(i * 37 + 13) % 100}%`,
      top: `${(i * 53 + 7) % 100}%`,
      size: ((i * 19) % 25) / 10 + 0.5,
      delay: `${((i * 11) % 50) / 10}s`,
      duration: `${2.5 + ((i * 7) % 30) / 10}s`,
      opacity: ((i * 13) % 40) / 100 + 0.08,
    }));
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full twinkle"
          style={{
            left: star.left,
            top: star.top,
            width: star.size + 'px',
            height: star.size + 'px',
            '--star-opacity': star.opacity,
            animationDelay: star.delay,
            animationDuration: star.duration,
          } as React.CSSProperties & Record<string, string | number>}
        />
      ))}
    </div>
  );
}
