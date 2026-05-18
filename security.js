/**
 * security.js - アンチチート & セキュリティ検証モジュール
 */

export class AntiCheat {
    constructor(options = {}) {
        this.ppsThreshold = options.ppsThreshold || 5.0; // 1秒あたりのミノ設置数
        this.stats = {
            piecesPlaced: 0,
            startTime: Date.now(),
            history: []
        };
        this.violations = [];
    }

    /**
     * ミノ設置時の検証
     * @param {Object} engineState - CoreEngine の状態
     */
    validatePieceLock(engineState) {
        this.stats.piecesPlaced++;
        const now = Date.now();
        const elapsed = (now - this.stats.startTime) / 1000;
        const currentPPS = this.stats.piecesPlaced / (elapsed || 0.001);

        // PPS 検知 (一定以上の設置速度)
        if (currentPPS > this.ppsThreshold && elapsed > 5) {
            this.recordViolation('EXCESSIVE_PPS', { pps: currentPPS });
        }

        // 不正な移動/回転の検証 (簡易版)
        if (engineState.current) {
            const p = engineState.current;
            if (p.x < -4 || p.x > 12 || p.y > 22) {
                this.recordViolation('INVALID_COORDINATES', { x: p.x, y: p.y });
            }
        }
    }

    /**
     * 統計情報の検証
     */
    validateStats(stats) {
        // 異常なスコア上昇率、攻撃効率などをチェック
        if (stats.attackSent > 0 && stats.linesCleared > 0) {
            const efficiency = stats.attackSent / stats.linesCleared;
            if (efficiency > 5.0) { // テトリス(4ライン/4攻撃)でも 1.0 程度
                this.recordViolation('ABNORMAL_EFFICIENCY', { efficiency });
            }
        }
    }

    recordViolation(type, details) {
        const entry = { type, details, ts: Date.now() };
        this.violations.push(entry);
        console.warn(`[AntiCheat] Violation detected: ${type}`, details);
    }

    hasCriticalViolations() {
        return this.violations.length >= 3;
    }
}

/**
 * 管理者権限の検証 (クライアント側)
 * Note: 本来は Firebase Custom Claims をサーバー側で検証すべきだが、
 * クライアント側でも最低限のガードを設ける。
 */
export async function verifyAdminStatus(user) {
    if (!user) return false;
    try {
        const idTokenResult = await user.getIdTokenResult();
        return !!idTokenResult.claims.admin;
    } catch (e) {
        return false;
    }
}
