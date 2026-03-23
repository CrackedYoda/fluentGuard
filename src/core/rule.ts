import { EvaluationResult, RuleNode, Validator } from "./types";


function resolveMessage<User, Context>(
    message: string | ((user: User, context: Context) => string),
    user: User,
    context: Context
): string {
    return typeof message === 'function'
        ? message(user, context)
        : message;
}



export type RuleMode = 'all' | 'any' | 'not';

export class Rule<User = any, Context = any> {
    private validators: Validator<User, Context>[];
    private mode: RuleMode;

    constructor(validators: Validator<User, Context>[], mode: RuleMode = 'all') {
        this.validators = validators;
        this.mode = mode;
    }

    static all<User, Context>(
        validators: Validator<User, Context>[]
    ) {
        return new Rule(validators, 'all');
    }

    static any<User, Context>(
        validators: Validator<User, Context>[]
    ) {
        return new Rule(validators, 'any');
    }

    static not<User, Context>(
        validator: Validator<User, Context>
    ) {
        return new Rule([validator], 'not');
    }


    async evaluate(user: User, context: Context): Promise<EvaluationResult> {
        if (this.mode === 'all') {
            for (const validator of this.validators) {
                const result = await Promise.resolve(validator.check(user, context));
                if (!result) {
                    return {
                        pass: false,
                        reason: resolveMessage(validator.message, user, context),
                        failedAtRule: validator.name
                    };
                }
            }
            return { pass: true };
        }

        if (this.mode === 'any') {
            let lastReason: string | undefined;
            let lastFailedRule: string | undefined;

            for (const validator of this.validators) {
                const result = await Promise.resolve(validator.check(user, context));
                if (result) {
                    return { pass: true };
                }
                lastReason = resolveMessage(validator.message, user, context);
                lastFailedRule = validator.name;
            }

            return {
                pass: false,
                reason: lastReason || 'No rules matched in Rule.any()',
                failedAtRule: lastFailedRule
            };
        }

        if (this.mode === 'not') {
            const validator = this.validators[0];
            const result = await Promise.resolve(validator.check(user, context));
            if (result) {
                return {
                    pass: false,
                    reason: resolveMessage(validator.message, user, context),
                    failedAtRule: validator.name
                };
            }
            return { pass: true };
        }

        return { pass: true };
    }
}