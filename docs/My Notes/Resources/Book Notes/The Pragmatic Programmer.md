---
author: David Thomas & Andrew Hunt
rating: 4
status: finished
finished: 2026-02-28
tags: [books, coding]
---

# The Pragmatic Programmer

#books #coding

## Overview

Originally published in 1999, the 20th Anniversary Edition (2019) is a thorough revision that remains remarkably current. Hunt and Thomas present software development as a craft — something you improve through deliberate practice, careful thinking, and professional responsibility. The tone is direct and mentor-like, full of aphorisms that stick.

The central metaphor is the **broken windows theory** applied to code: don't leave bad code unfixed; entropy spreads fast once a codebase starts rotting. Related to that is the concept of the **pragmatic programmer** as someone who takes ownership of the entire outcome, not just their assigned ticket.

---

## Key Principles

### Don't Repeat Yourself (DRY)

The DRY principle — "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system" — is one of the most misunderstood rules in software. It's not just about duplicate code; it's about duplicate *knowledge*. Two modules that encode the same business rule independently will eventually diverge. The fix is canonical representation, not copy-paste detection.

### Orthogonality

Two components are orthogonal if changes to one don't affect the other. Orthogonal systems are easier to test, easier to reason about, and less likely to surprise you. The test: "If I change X, how many other things do I have to touch?" Strive for that number to be one.

### Tracer Bullets vs. Prototypes

- **Tracer bullets**: thin, complete, production-quality slices through the full stack — used to validate architecture and get real feedback early. The code stays.
- **Prototypes**: throwaway explorations of a specific risk or unknown. The code is *always* deleted.

Conflating these two causes enormous damage. "Prototype-quality" code that ships is one of the most common sources of technical debt.

### Design by Contract

Functions and modules should declare what they *require* (preconditions) and what they *guarantee* (postconditions). This makes reasoning about correctness explicit. Modern type systems help, but they don't replace the discipline of thinking through invariants carefully.

### The Importance of Plain Text

Data in plain text (including source, config, and data pipelines) is inspectable, debuggable, and durable. Binary formats rot. Unix tools compose naturally over text. Prefer text wherever the performance cost is acceptable.

---

## Code Examples

A Ruby example the book uses to illustrate DRY violations — the kind of duplication that creeps in through parallel data structures:

```ruby
# BAD: age encoded in two places
AGES = {
  "Alice" => 30,
  "Bob"   => 25
}

def display_user(name)
  age = AGES[name]  # knowledge duplicated every call site
  puts "#{name} is #{age} years old"
end

# BETTER: single source of truth
User = Struct.new(:name, :age)
USERS = [User.new("Alice", 30), User.new("Bob", 25)]

def display_user(user)
  puts "#{user.name} is #{user.age} years old"
end
```

A Python illustration of Design by Contract using assertions to make preconditions explicit:

```python
def calculate_discount(price: float, rate: float) -> float:
    """Apply a discount rate to a price.

    Preconditions:  price >= 0, 0 <= rate <= 1
    Postcondition:  result >= 0 and result <= price
    """
    assert price >= 0, f"price must be non-negative, got {price}"
    assert 0 <= rate <= 1, f"rate must be in [0,1], got {rate}"

    result = price * (1 - rate)

    assert 0 <= result <= price  # postcondition
    return result
```

In production, assertions can be disabled with `-O`, but during development they make violations visible immediately rather than propagating corrupted state.

---

## Takeaways

- **Fix broken windows immediately.** One ugly hack left in signals that quality doesn't matter. Others follow.
- **Be a catalyst for change**, not a complainer. Bring the village the soup stone — start the change yourself.
- **Know your tools deeply.** Shell, editor, debugger, VCS. Time invested compounds. Relevant to [[Git Commands]].
- **Critically evaluate everything you read and hear** — including this book. The pragmatic programmer thinks, doesn't just follow.
- The chapter on **estimation** is underrated. Techniques for scoping tasks honestly have already changed how I write tickets.

Highly recommended pairing with [[Learn Rust]] — the ownership model is one of the best practical implementations of Design by Contract ideas in a mainstream language.

See also [[Build a Personal Website]] (tracer-bullet approach worked well for that project) and [[Career Development]].
