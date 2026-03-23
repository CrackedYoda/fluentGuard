import { Rule } from "./rule";
import { RuleDeniedError } from "./error";

type Options = {
  resolveUser?: (args: any[]) => any
  resolveContext?: (args: any[]) => any
}

export function buildGuard(rule: Rule, ruleName: string) {
  
  const wrapper = (fn: Function, options: Options = {}) => {
    return async (...args: any[]) => {
      const user = options.resolveUser?.(args) ?? args[0]
      const context = options.resolveContext?.(args) ?? args[1]

      // Fix #2: Reject if user could not be resolved
      if (user === undefined || user === null) {
        throw new RuleDeniedError(ruleName, 'Could not resolve user from arguments')
      }

      const result = await rule.evaluate(user, context)

      if (!result.pass) {
        throw new RuleDeniedError(
          ruleName,
          result.reason || 'Access denied',
          result.failedAtRule
        )
      }

      return fn(...args)
    }
  }

  // SAFE MODE
  // Fix #4: Only catch RuleDeniedError, re-throw unexpected errors
  wrapper.safe = (fn: Function, options: Options = {}) => {
    return async (...args: any[]) => {
      try {
        const data = await wrapper(fn, options)(...args)
        return { success: true, data }
      } catch (error) {
        if (error instanceof RuleDeniedError) {
          return { success: false, error }
        }
        throw error
      }
    }
  }

  return wrapper
}