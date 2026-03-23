export type CheckFn<User, Context> = (user: User, context: Context) => boolean | Promise<boolean>;


export type MessageFn<User, Context> = (user: User, context: Context) => string;


export type Validator<User, Context> = {
    name?: string;
    check: CheckFn<User, Context>;
    message: MessageFn<User, Context>;
}
export type RuleNode<User, Context> = {
    evaluate(user: User, context: Context): Awaitable<EvaluationResult>;
}

export type EvaluationResult = {
    pass: boolean;
    reason?: string;
    failedAtRule?: string;
}
export type SchemaConfig = Record<string, RuleNode<any, any>>;

// export type GuardOptions<User, Context, Args extends any[], FallbackReturn = any> = {
//     extract?: (args: Args) => { user: User; context: Context };
//     fallback?: (user: User, context: Context, reason?: string) => FallbackReturn;
// }
// export type GuardMethod<User, Context> = {
//     <F extends (...args: any[]) => any, FallbackReturn = never>(
//         fnToWrap: F,
//         options?: GuardOptions<User, Context, Parameters<F>, FallbackReturn>
//     ): (...args: Parameters<F>) => Awaitable<ReturnType<F> | FallbackReturn>;
//     explain(user: User, context: Context): Awaitable<EvaluationResult>;
// }
// export type GuardFactory<Schema extends SchemaConfig> = {
//     [K in keyof Schema]: Schema[K] extends RuleNode<infer User, infer Context>
//         ? GuardMethod<User, Context>
//         : never;
// };
// export type FluentGuardInstance<Schema extends SchemaConfig> = {
//     guard: GuardFactory<Schema>;
//     rules: Schema;
// };
// export type RuleDeniedError = Error & {
//     ruleName: string;
//     reason?: string;
// };
export type Awaitable<T> = T | Promise<T>;