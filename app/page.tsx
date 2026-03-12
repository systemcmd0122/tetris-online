"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { APP_VERSION, UPDATE_LOG } from "@/lib/config";

const COLORS: Record<string, string> = {
  I: "#00f5ff",
  O: "#ffff00",
  T: "#cc00ff",
  S: "#aaff00",
  Z: "#ff0040",
  J: "#0066ff",
  L: "#ff8800",
};
const CNAMES = Object.keys(COLORS);

const PIECE_MATS: Record<string, number[][][]> = {
  I: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]],
  O: [[[1, 1], [1, 1]]],
  T: [[[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]]],
  S: [[[0, 1, 1], [1, 1, 0]]],
  Z: [[[1, 1, 0], [0, 1, 1]]],
  J: [[[1, 0, 0], [1, 1, 1]]],
  L: [[[0, 0, 1], [1, 1, 1]]],
};

interface FallingPiece {
  mat: number[][];
  color: string;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vr: number;
  sc: number;
  alpha: number;
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState("LOADING...");

  // Loading animation
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setLoadProgress(step);
      if (step === 4) setLoadText("CONNECTING...");
      if (step === 8) setLoadText("INITIALIZING...");
      if (step >= 12) {
        setLoadText("READY!");
        clearInterval(interval);
        setTimeout(() => setLoading(false), 350);
      }
    }, 60 + Math.random() * 80);
    return () => clearInterval(interval);
  }, []);

  // Check for update modal
  useEffect(() => {
    const lastSeen = localStorage.getItem("lastSeenVersion");
    if (lastSeen !== APP_VERSION) {
      setTimeout(() => setShowModal(true), 2000);
    }
  }, []);

  // Background animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 30;
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const pieces: FallingPiece[] = [];

    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const spawn = (): FallingPiece => {
      const name = CNAMES[Math.floor(Math.random() * CNAMES.length)];
      const rots = PIECE_MATS[name];
      const mat = rots[Math.floor(Math.random() * rots.length)];
      return {
        mat,
        color: COLORS[name],
        x: Math.random() * W,
        y: -CELL * 4,
        vy: 0.5 + Math.random() * 1.5,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 0.8,
        sc: 0.55 + Math.random() * 0.9,
        alpha: 0.12 + Math.random() * 0.45,
      };
    };

    for (let i = 0; i < 20; i++) {
      const p = spawn();
      p.y = Math.random() * H;
      pieces.push(p);
    }

    const drawBlock = (bx: number, by: number, color: string) => {
      ctx.fillStyle = color + "bb";
      ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(bx + 1, by + 1, CELL - 2, 5);
      ctx.fillRect(bx + 1, by + 1, 5, CELL - 2);
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillRect(bx + 2, by + CELL - 4, CELL - 3, 3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx + 0.5, by + 0.5, CELL - 1, CELL - 1);
    };

    let animId: number;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      pieces.forEach((p, i) => {
        p.y += p.vy;
        p.rot += p.vr;
        const mh = p.mat.length * CELL * p.sc;
        if (p.y > H + mh * 2) pieces[i] = spawn();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.scale(p.sc, p.sc);
        ctx.globalAlpha = p.alpha;
        const mw = p.mat[0].length;
        const mhh = p.mat.length;
        const ox = (-mw * CELL) / 2;
        const oy = (-mhh * CELL) / 2;
        p.mat.forEach((row, r) =>
          row.forEach((cell, c) => {
            if (cell) drawBlock(ox + c * CELL, oy + r * CELL, p.color);
          })
        );
        ctx.restore();
      });
      if (Math.random() < 0.015 && pieces.length < 24) pieces.push(spawn());
      animId = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  const closeModal = () => {
    localStorage.setItem("lastSeenVersion", APP_VERSION);
    setShowModal(false);
  };

  const latest = UPDATE_LOG[0];

  return (
    <>
      {/* Loading Screen */}
      {loading && (
        <div className="loading-screen">
          <div className="ld-logo">TETRIS BATTLE</div>
          <div className="ld-sub">ONLINE MODE</div>
          <div className="tetro-loader">
            <div className="tetro-bar">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={`tb-block ${i < loadProgress ? "lit" : ""}`}
                  style={
                    i < loadProgress
                      ? {
                          background: [
                            COLORS.I,
                            COLORS.J,
                            COLORS.T,
                            COLORS.S,
                            COLORS.O,
                            COLORS.Z,
                            COLORS.L,
                            COLORS.I,
                            COLORS.J,
                            COLORS.T,
                            COLORS.S,
                            COLORS.O,
                          ][i],
                          boxShadow: `0 0 14px ${
                            [
                              COLORS.I,
                              COLORS.J,
                              COLORS.T,
                              COLORS.S,
                              COLORS.O,
                              COLORS.Z,
                              COLORS.L,
                              COLORS.I,
                              COLORS.J,
                              COLORS.T,
                              COLORS.S,
                              COLORS.O,
                            ][i]
                          }`,
                        }
                      : {}
                  }
                />
              ))}
            </div>
            <div className="ld-text">{loadText}</div>
          </div>
        </div>
      )}

      {/* Background */}
      <canvas ref={canvasRef} className="bg-canvas" />
      <div className="scanlines" />
      <div className="scan-beam" />

      {/* Main Content */}
      <div className="container">
        <div className="pixel-deco">
          <div className="px-row">
            <div className="px px-I" />
            <div className="px px-I" />
            <div className="px px-I" />
            <div className="px px-I" />
          </div>
          <div className="px-row">
            <div className="px-empty" />
            <div className="px px-T" />
            <div className="px px-T" />
            <div className="px px-T" />
            <div className="px-empty" />
          </div>
          <div className="px-row">
            <div className="px-empty" />
            <div className="px-empty" />
            <div className="px px-T" />
            <div className="px-empty" />
            <div className="px-empty" />
          </div>
        </div>
        <div className="logo">TETRIS BATTLE</div>
        <div className="subtitle">ONLINE MODE</div>
        <div className="menu-card">
          <div className="card-corner tl" />
          <div className="card-corner tr" />
          <div className="card-corner bl" />
          <div className="card-corner br" />
          <div className="menu">
            <Link href="/tetris-battle" className="menu-btn primary">
              PLAY
            </Link>
            <Link href="/how-to" className="menu-btn secondary">
              HOW TO PLAY
            </Link>
            <Link href="/updates" className="menu-btn secondary">
              UPDATES
            </Link>
            <Link href="/admin" className="menu-btn secondary">
              ADMIN
            </Link>
          </div>
        </div>
      </div>
      <div className="footer">
        <span className="version">VER {APP_VERSION}</span>
        <span>2025 TETRIS BATTLE ONLINE</span>
      </div>

      {/* Update Modal */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="update-modal">
            <div className="modal-close" onClick={closeModal}>
              x
            </div>
            <div className="um-version">Ver. {latest.version}</div>
            <div className="um-title">{latest.title}</div>
            <ul className="um-list">
              {latest.changes.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
            <div className="modal-btns">
              <Link href="/updates" className="modal-btn secondary">
                View Full Log
              </Link>
              <div className="modal-btn primary" onClick={closeModal}>
                Close
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .loading-screen {
          position: fixed;
          inset: 0;
          background: #04060f;
          z-index: 200;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 36px;
        }
        .ld-logo {
          font-family: "Press Start 2P", monospace;
          font-size: clamp(16px, 4vw, 28px);
          color: var(--acc);
          text-shadow: 0 0 20px rgba(0, 245, 255, 0.8),
            3px 3px 0 rgba(0, 40, 80, 0.9);
          letter-spacing: 4px;
        }
        .ld-sub {
          font-family: "Press Start 2P", monospace;
          font-size: 8px;
          color: var(--acc2);
          letter-spacing: 3px;
          margin-top: -20px;
        }
        .tetro-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .tetro-bar {
          display: flex;
          gap: 5px;
        }
        .tb-block {
          width: 24px;
          height: 24px;
          border-radius: 3px;
          background: #0d1525;
          border: 1px solid #1a2540;
          transition: background 0.1s, box-shadow 0.1s;
          position: relative;
        }
        .tb-block.lit::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          right: 3px;
          height: 5px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 1px;
        }
        .ld-text {
          font-family: "Press Start 2P", monospace;
          font-size: 8px;
          color: var(--dim);
          letter-spacing: 3px;
          animation: ldBlink 1.2s step-end infinite;
        }
        @keyframes ldBlink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.25;
          }
        }

        .bg-canvas {
          position: fixed;
          inset: 0;
          z-index: 0;
        }
        .container {
          position: relative;
          z-index: 10;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .pixel-deco {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          margin-bottom: 14px;
        }
        .px-row {
          display: flex;
          gap: 4px;
        }
        .px {
          width: 13px;
          height: 13px;
          border-radius: 2px;
          animation: pxFloat 3s ease-in-out infinite;
        }
        .px:nth-child(odd) {
          animation-delay: 0.15s;
        }
        .px:nth-child(even) {
          animation-delay: 0.3s;
        }
        @keyframes pxFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        .px-empty {
          width: 13px;
          height: 13px;
        }
        .px-I {
          background: #00f5ff;
          box-shadow: 0 0 6px #00f5ff;
        }
        .px-O {
          background: #ffff00;
          box-shadow: 0 0 6px #ffff00;
        }
        .px-T {
          background: #cc00ff;
          box-shadow: 0 0 6px #cc00ff;
        }
        .px-S {
          background: #aaff00;
          box-shadow: 0 0 6px #aaff00;
        }
        .px-Z {
          background: #ff0040;
          box-shadow: 0 0 6px #ff0040;
        }
        .px-J {
          background: #0066ff;
          box-shadow: 0 0 6px #0066ff;
        }
        .px-L {
          background: #ff8800;
          box-shadow: 0 0 6px #ff8800;
        }

        .logo {
          font-family: "Press Start 2P", monospace;
          font-size: clamp(22px, 5vw, 44px);
          color: var(--acc);
          text-shadow: 0 0 10px rgba(0, 245, 255, 0.9),
            0 0 30px rgba(0, 245, 255, 0.5), 0 0 80px rgba(0, 245, 255, 0.3),
            3px 3px 0 rgba(0, 60, 100, 0.9);
          letter-spacing: 6px;
          margin-bottom: 10px;
          animation: logoFlicker 5s ease-in-out infinite;
        }
        @keyframes logoFlicker {
          0%,
          94%,
          100% {
            opacity: 1;
          }
          95% {
            opacity: 0.82;
          }
          97% {
            opacity: 1;
          }
          98% {
            opacity: 0.9;
          }
        }
        .subtitle {
          font-family: "Press Start 2P", monospace;
          font-size: clamp(8px, 1.5vw, 10px);
          color: var(--acc2);
          letter-spacing: 3px;
          margin-bottom: 40px;
          text-shadow: 0 0 15px rgba(255, 0, 128, 0.7);
          animation: subPulse 2.5s ease-in-out infinite;
        }
        @keyframes subPulse {
          0%,
          100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 25px rgba(255, 0, 128, 1),
              0 0 50px rgba(255, 0, 128, 0.4);
          }
        }

        .menu-card {
          background: rgba(4, 6, 15, 0.88);
          border: 2px solid rgba(0, 245, 255, 0.22);
          border-radius: 2px;
          padding: 32px 36px;
          width: 100%;
          max-width: 320px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(12px);
        }
        .menu-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(
            90deg,
            #cc00ff,
            #0066ff,
            #00f5ff,
            #aaff00,
            #ff8800,
            #ff0040,
            #cc00ff
          );
          background-size: 300% 100%;
          animation: rainbowShift 3s linear infinite;
        }
        @keyframes rainbowShift {
          0% {
            background-position: 0% 0;
          }
          100% {
            background-position: 300% 0;
          }
        }
        .card-corner {
          position: absolute;
          width: 10px;
          height: 10px;
          background: var(--acc);
          box-shadow: 0 0 8px var(--acc);
        }
        .card-corner.tl {
          top: 4px;
          left: 0;
        }
        .card-corner.tr {
          top: 4px;
          right: 0;
        }
        .card-corner.bl {
          bottom: 0;
          left: 0;
        }
        .card-corner.br {
          bottom: 0;
          right: 0;
        }

        .menu {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
        }
        .menu-btn {
          display: block;
          width: 100%;
          padding: 15px 20px;
          font-family: "Press Start 2P", monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-decoration: none;
          text-align: center;
          border: none;
          cursor: pointer;
          transition: all 0.12s;
          position: relative;
          overflow: hidden;
          border-radius: 2px;
        }
        .menu-btn.primary {
          background: var(--acc);
          color: #000;
          box-shadow: 0 5px 0 rgba(0, 80, 100, 0.9),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .menu-btn.primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 0 rgba(0, 80, 100, 0.9),
            0 0 35px rgba(0, 245, 255, 0.7),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .menu-btn.primary:active {
          transform: translateY(3px);
          box-shadow: 0 2px 0 rgba(0, 80, 100, 0.9);
        }
        .menu-btn.secondary {
          background: rgba(255, 0, 128, 0.05);
          color: var(--acc2);
          border: 2px solid var(--acc2);
          box-shadow: 0 5px 0 rgba(100, 0, 50, 0.9);
        }
        .menu-btn.secondary:hover {
          background: rgba(255, 0, 128, 0.1);
          transform: translateY(-3px);
          box-shadow: 0 8px 0 rgba(100, 0, 50, 0.9),
            0 0 25px rgba(255, 0, 128, 0.6);
        }
        .menu-btn.secondary:active {
          transform: translateY(3px);
          box-shadow: 0 2px 0 rgba(100, 0, 50, 0.9);
        }

        .footer {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          color: var(--dim);
          letter-spacing: 2px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .version {
          color: var(--acc2);
          font-weight: bold;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(6px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }
        .modal-overlay.show {
          opacity: 1;
          pointer-events: auto;
        }
        .update-modal {
          background: var(--s0);
          border: 2px solid var(--acc);
          border-radius: 4px;
          padding: 32px;
          width: min(450px, 90vw);
          position: relative;
          box-shadow: 0 0 40px rgba(0, 245, 255, 0.25);
        }
        .modal-close {
          position: absolute;
          top: 10px;
          right: 14px;
          cursor: pointer;
          color: var(--dim);
          font-size: 20px;
          transition: color 0.2s;
        }
        .modal-close:hover {
          color: var(--acc2);
        }
        .um-version {
          font-family: "Press Start 2P", monospace;
          font-size: 10px;
          color: var(--acc2);
          margin-bottom: 12px;
        }
        .um-title {
          font-size: 18px;
          color: var(--acc);
          margin-bottom: 18px;
          letter-spacing: 1px;
          font-weight: bold;
        }
        .um-list {
          list-style: none;
          margin-bottom: 24px;
        }
        .um-list li {
          font-size: 13px;
          margin-bottom: 10px;
          position: relative;
          padding-left: 18px;
          line-height: 1.5;
        }
        .um-list li::before {
          content: ">";
          position: absolute;
          left: 0;
          color: var(--acc3);
          font-size: 9px;
          top: 4px;
        }
        .modal-btns {
          display: flex;
          gap: 12px;
        }
        .modal-btn {
          flex: 1;
          padding: 12px;
          border-radius: 2px;
          cursor: pointer;
          font-family: "Orbitron", monospace;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s;
        }
        .modal-btn.primary {
          background: var(--acc);
          color: #000;
          border: none;
        }
        .modal-btn.secondary {
          background: transparent;
          border: 1px solid var(--dim);
          color: var(--tx);
        }
        .modal-btn:hover {
          transform: translateY(-2px);
          opacity: 0.9;
        }
      `}</style>
    </>
  );
}
