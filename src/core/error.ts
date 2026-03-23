export class RuleDeniedError extends Error {    
    ruleName: string;
    reason?: string;
    failedAtRule?: string;
    
    constructor(ruleName: string, reason?: string, failedAtRule?: string) {
        super(reason);
        this.name = 'RuleDeniedError';
        this.ruleName = ruleName;
        this.reason = reason;
        this.failedAtRule = failedAtRule;
        // Fix #7: Preserve correct stack trace origin
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RuleDeniedError);
        }
    }
}