"use client";

import Link from "next/link";

export default function HowToPage() {
  return (
    <div className="container">
      <div className="logo">HOW TO PLAY</div>

      <section>
        <h2>Basic Controls</h2>
        <div className="controls">
          <div className="key">LEFT/RIGHT</div>
          <div>Move left/right</div>
          <div className="key">UP / X</div>
          <div>Rotate clockwise</div>
          <div className="key">Z</div>
          <div>Rotate counter-clockwise</div>
          <div className="key">DOWN</div>
          <div>Soft drop (fall faster)</div>
          <div className="key">SPACE</div>
          <div>Hard drop (instant drop and lock)</div>
          <div className="key">Shift / C</div>
          <div>Hold (save a piece)</div>
        </div>
      </section>

      <section>
        <h2>Battle Mechanics (Garbage Blocks)</h2>
        <p>
          Clear multiple lines at once to send <span className="highlight">garbage blocks</span> to
          your opponent.
        </p>
        <ul>
          <li>
            <span className="highlight">2 Lines (Double)</span>: Send 1 line
          </li>
          <li>
            <span className="highlight">3 Lines (Triple)</span>: Send 2 lines
          </li>
          <li>
            <span className="highlight">4 Lines (Tetris)</span>: Send 4 lines
          </li>
        </ul>
      </section>

      <section>
        <h2>Technical Bonuses</h2>
        <p>Advanced line clears give you bonus attack power.</p>
        <ul>
          <li>
            <span className="highlight">Combo</span>: Clear lines consecutively to add bonus lines
            based on combo count.
          </li>
          <li>
            <span className="highlight">T-Spin</span>: Twist a T-piece into a tight space for
            extra attack power.
          </li>
          <li>
            <span className="highlight">Back-to-Back (B2B)</span>: Perform Tetris or T-Spin
            consecutively for 1.5x attack power.
          </li>
        </ul>
      </section>

      <section>
        <h2>Win Condition</h2>
        <p>
          The player whose blocks reach the top of the screen loses. Apply pressure to your
          opponent and force them to make mistakes!
        </p>
      </section>

      <Link href="/" className="back-btn">
        BACK TO MENU
      </Link>

      <style jsx>{`
        .container {
          background: var(--bg);
          color: var(--tx);
          font-family: "Orbitron", monospace;
          padding: 40px 20px;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          min-height: 100vh;
        }
        .logo {
          font-family: "Press Start 2P", monospace;
          font-size: clamp(18px, 4vw, 32px);
          color: var(--acc);
          text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
          text-align: center;
          margin-bottom: 40px;
        }
        section {
          margin-bottom: 30px;
        }
        h2 {
          font-family: "Press Start 2P", monospace;
          font-size: 14px;
          color: var(--acc2);
          margin: 30px 0 15px;
          border-bottom: 2px solid var(--acc2);
          padding-bottom: 5px;
        }
        p {
          margin-bottom: 15px;
          font-size: 14px;
        }
        .controls {
          background: var(--s0);
          border: 1px solid var(--dim);
          padding: 20px;
          border-radius: 4px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px 20px;
          align-items: center;
          margin-bottom: 30px;
        }
        .key {
          background: #1a2540;
          border: 1px solid var(--acc);
          color: var(--acc);
          padding: 4px 10px;
          border-radius: 3px;
          font-family: monospace;
          font-weight: bold;
          min-width: 60px;
          text-align: center;
        }
        ul {
          list-style: none;
          padding: 0;
        }
        li {
          margin-left: 20px;
          margin-bottom: 10px;
          font-size: 14px;
          position: relative;
        }
        li::before {
          content: ">";
          position: absolute;
          left: -20px;
          color: var(--acc3);
          font-size: 12px;
        }
        .highlight {
          color: var(--acc3);
          font-weight: bold;
        }
        .back-btn {
          display: inline-block;
          padding: 12px 24px;
          background: var(--acc);
          color: #000;
          text-decoration: none;
          font-family: "Press Start 2P", monospace;
          font-size: 10px;
          margin-top: 40px;
          border-radius: 2px;
          transition: transform 0.2s;
        }
        .back-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
