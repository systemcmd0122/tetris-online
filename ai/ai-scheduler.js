/**
 * ai-scheduler.js - 複数 AI Worker の集中管理と同期
 */

export class AIScheduler {
    constructor() {
        this.workers = new Map(); // id -> Worker
        this.states = new Map();  // id -> AIState
        this.paused = false;
        this.speed = 1.0;
        this.frame = 0;
    }

    /**
     * AI を登録し、専用 Worker を起動
     */
    registerAI(id, profile) {
        const worker = new Worker('./workers/ai-worker.js', { type: 'module' });

        const aiState = {
            id,
            profile,
            lastThinkFrame: 0,
            isThinking: false,
            queuedActions: [],
            stats: { apm: [], pps: [], attack: [], combo: [] },
            heat: 0,
            mutationLevel: 1
        };

        worker.onmessage = (e) => {
            if (e.data.type === 'MOVE') {
                aiState.queuedActions = e.data.action;
                aiState.isThinking = false;
            }
        };

        this.workers.set(id, worker);
        this.states.set(id, aiState);
        return aiState;
    }

    /**
     * 全 AI の状態を 1 フレーム更新
     */
    update(engines) {
        if (this.paused) return;
        this.frame++;

        for (let [id, engine] of engines) {
            const state = this.states.get(id);
            if (!state || engine.over) continue;

            // 思考タイミングの判定 (Scheduler によるスロットリング)
            const interval = state.profile.thinkInterval || 5;
            if (!state.isThinking && (this.frame - state.lastThinkFrame >= interval || this.frame === 1)) {
                if (engine.waitingFrames === 1 || this.frame === 1) {
                    this._requestThink(id, engine, state);
                }
            }

            // アクションの適用
            if (state.queuedActions.length > 0) {
                // スピードに応じて 1 フレームに適用するアクション数を変える
                const actionsPerFrame = Math.ceil(this.speed);
                for (let i = 0; i < actionsPerFrame; i++) {
                    if (state.queuedActions.length === 0) break;
                    const action = state.queuedActions.shift();
                    this._applyAction(engine, action);
                }
            }
        }
    }

    _requestThink(id, engine, state) {
        const worker = this.workers.get(id);
        state.isThinking = true;
        state.lastThinkFrame = this.frame;

        worker.postMessage({
            type: 'THINK',
            pieceId: engine.pieceCount,
            board: engine.board,
            current: engine.current.name,
            hold: engine.held,
            next: engine.bag.peek(1)[0],
            canHold: engine.canHold,
            weights: state.profile.baseWeights,
            difficulty: state.mutationLevel,
            seed: engine.seed + this.frame
        });
    }

    _applyAction(engine, action) {
        if (action === 'MOVE_L') engine.move(-1);
        else if (action === 'MOVE_R') engine.move(1);
        else if (action === 'ROT_R') engine.rotate(1);
        else if (action === 'ROT_L') engine.rotate(-1);
        else if (action === 'HARD_DROP') engine.hardDrop();
        else if (action === 'HOLD') engine.hold();
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    pause() { this.paused = true; }
    resume() { this.paused = false; }

    terminateAll() {
        for (let worker of this.workers.values()) {
            worker.terminate();
        }
        this.workers.clear();
        this.states.clear();
    }
}
