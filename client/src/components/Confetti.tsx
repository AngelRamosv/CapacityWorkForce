import React, { useEffect, useState } from 'react';

const Confetti = ({ duration = 5000 }) => {
    const [pieces, setPieces] = useState<any[]>([]);

    useEffect(() => {
        const colors = ['#fce18a', '#ff726d', '#b48def', '#f4306d', '#32cd32', '#00bfff'];
        const newPieces = Array.from({ length: 150 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            animationDuration: Math.random() * 3 + 2,
            animationDelay: Math.random() * 2,
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            width: Math.random() * 10 + 5,
            height: Math.random() * 20 + 10,
            rotation: Math.random() * 360,
        }));
        setPieces(newPieces);

        const timer = setTimeout(() => {
            setPieces([]);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    if (pieces.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {pieces.map((p) => (
                <div
                    key={p.id}
                    className="absolute top-[-5vh] animate-fall"
                    style={{
                        left: `${p.left}vw`,
                        width: `${p.width}px`,
                        height: `${p.height}px`,
                        backgroundColor: p.backgroundColor,
                        transform: `rotate(${p.rotation}deg)`,
                        animation: `fall ${p.animationDuration}s linear ${p.animationDelay}s forwards`
                    }}
                />
            ))}
            <style>{`
                @keyframes fall {
                    0% { transform: translateY(-5vh) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default Confetti;
