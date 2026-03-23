import { buildGuard } from './guard'
import { Rule } from './rule'

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function createSchema(schema: Record<string, Rule>) {
  
  const frozenSchema = Object.freeze({ ...schema })

  const guard = new Proxy({}, {
    get(_, ruleName: string) {
      // Fix #1: Block prototype pollution vectors
      if (typeof ruleName !== 'string' || BLOCKED_KEYS.has(ruleName)) {
        return undefined
      }

      const rule = frozenSchema[ruleName]

      if (!rule) {
        throw new Error(`Rule "${ruleName}" not found`)
      }

      return buildGuard(rule, ruleName)
    }
  })

  // Fix #6: Return frozen rules to prevent runtime mutation
  return {
    guard,
    rules: frozenSchema
  }
}