"use client";

import Link from "next/link";
import { UPDATE_LOG } from "@/lib/config";

export default function UpdatesPage() {
  return (
    <div className="container">
      <div className="logo">UPDATE LOG</div>

      <div className="update-container">
        {UPDATE_LOG.map((item, index) => (
          <div key={index} className="update-item">
            <div className="version-tag">Ver. {item.version}</div>
            <div className="update-title">{item.title}</div>
            <ul>
              {item.changes.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
        .update-container {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        .update-item {
          background: var(--s0);
          border: 1px solid var(--dim);
          padding: 24px;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }
        .update-item::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--acc), var(--acc2));
        }
        .version-tag {
          font-family: "Press Start 2P", monospace;
          font-size: 14px;
          color: var(--acc2);
          margin-bottom: 10px;
          display: inline-block;
        }
        .update-title {
          font-size: 18px;
          font-weight: bold;
          color: var(--acc);
          margin-bottom: 15px;
          letter-spacing: 1px;
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
          font-size: 10px;
          top: 4px;
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
