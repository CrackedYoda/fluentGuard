import { Rule } from './rule'
import { Validator } from './types'

type Step<User = any, Context = any> = {
  mode: 'and' | 'or' | 'not'
  validator: Validator<User, Context>
}

export class RuleBuilder<User = any, Context = any> {
  private steps: Step<User, Context>[] = []

  static where<User, Context>(validator: Validator<User, Context>): RuleBuilder<User, Context> {
    const builder = new RuleBuilder<User, Context>()
    builder.steps.push({ mode: 'and', validator })
    return builder
  }

  and(validator: Validator<User, Context>): this {
    this.steps.push({ mode: 'and', validator })
    return this
  }

  or(validator: Validator<User, Context>): this {
    this.steps.push({ mode: 'or', validator })
    return this
  }

  andNot(validator: Validator<User, Context>): this {
    this.steps.push({ mode: 'not', validator })
    return this
  }

  build(): Rule<User, Context> {
    // Group consecutive AND/NOT steps into Rule.all() blocks,
    // then join groups with Rule.any()

    const orGroups: Rule<User, Context>[] = []
    let currentAndGroup: Validator<User, Context>[] = []

    const flushAndGroup = () => {
      if (currentAndGroup.length > 0) {
        orGroups.push(Rule.all(currentAndGroup))
        currentAndGroup = []
      }
    }

    for (const step of this.steps) {
      if (step.mode === 'and') {
        currentAndGroup.push(step.validator)
      } else if (step.mode === 'not') {
        // Invert the check: pass when original fails, fail when original passes
        const original = step.validator
        currentAndGroup.push({
          name: original.name ? `not:${original.name}` : undefined,
          check: async (u, c) => !(await Promise.resolve(original.check(u, c))),
          message: original.message
        })
      } else if (step.mode === 'or') {
        flushAndGroup()
        // Start a new AND group with this validator
        currentAndGroup.push(step.validator)
      }
    }

    flushAndGroup()

    if (orGroups.length === 1) {
      return orGroups[0]
    }

    // Wrap each Rule.all group as a single validator for Rule.any
    const anyValidators: Validator<User, Context>[] = orGroups.map((rule, i) => ({
      name: `group_${i}`,
      check: async (u: User, c: Context) => {
        const result = await rule.evaluate(u, c)
        return result.pass
      },
      message: (u: User, c: Context) => `Rule group ${i} failed`
    }))

    return Rule.any(anyValidators)
  }
}
