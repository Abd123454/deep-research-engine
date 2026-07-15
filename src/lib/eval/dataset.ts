// Evaluation dataset for measuring research/coding/factual quality.
//
// Each query has objective pass/fail criteria:
//   - research: expected sources (URLs that should be cited) + expected keywords
//   - coding: a test that the generated code must pass
//   - factual: expected keywords that must appear in the answer
//
// The eval runner (runner.ts) executes each query and reports pass rate,
// average score, tokens used, and response time.

export type EvalQueryType = "research" | "coding" | "factual";
export type EvalDifficulty = "easy" | "medium" | "hard";

export interface EvalQuery {
  id: string;
  query: string;
  type: EvalQueryType;
  expectedSources?: string[]; // URL substrings that should appear in sources
  expectedKeywords?: string[]; // keywords that should appear in report/answer
  codingTest?: {
    language: "javascript" | "python";
    test: string; // test code appended to generated code
  };
  difficulty: EvalDifficulty;
}

export const EVAL_DATASET: EvalQuery[] = [
  // ===== Research queries (10) =====
  {
    id: "r1",
    query: "What is RISC-V and why is it important?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["open", "ISA", "instruction set"],
    difficulty: "easy",
  },
  {
    id: "r2",
    query: "Compare ARM and RISC-V architectures",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["ARM", "RISC-V", "license"],
    difficulty: "medium",
  },
  {
    id: "r3",
    query: "How do solid-state batteries work?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["electrolyte", "solid", "battery"],
    difficulty: "medium",
  },
  {
    id: "r4",
    query: "What is quantum error correction?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["qubit", "error", "code"],
    difficulty: "medium",
  },
  {
    id: "r5",
    query: "Explain how large language model agents work",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["agent", "tool", "language"],
    difficulty: "medium",
  },
  {
    id: "r6",
    query: "What are the main types of renewable energy?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["solar", "wind", "renewable"],
    difficulty: "easy",
  },
  {
    id: "r7",
    query: "How does CRISPR gene editing work?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["CRISPR", "Cas9", "DNA"],
    difficulty: "medium",
  },
  {
    id: "r8",
    query: "What is the difference between TCP and UDP?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["TCP", "UDP", "reliable"],
    difficulty: "easy",
  },
  {
    id: "r9",
    query: "Explain the CAP theorem in distributed systems",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["consistency", "availability", "partition"],
    difficulty: "hard",
  },
  {
    id: "r10",
    query: "What is blockchain consensus and how does PoW work?",
    type: "research",
    expectedSources: ["wikipedia.org"],
    expectedKeywords: ["blockchain", "consensus", "proof"],
    difficulty: "medium",
  },

  // ===== Coding queries (5) =====
  {
    id: "c1",
    query: "Write a Python function called reverse that reverses a string. It should take one argument and return the reversed string.",
    type: "coding",
    codingTest: {
      language: "python",
      test: "assert reverse('hello') == 'olleh'\nassert reverse('') == ''\nassert reverse('a') == 'a'\nassert reverse('abc') == 'cba'\nprint('All tests passed')",
    },
    difficulty: "easy",
  },
  {
    id: "c2",
    query: "Write a JavaScript function called binarySearch that takes a sorted array and a target value, returns the index or -1 if not found.",
    type: "coding",
    codingTest: {
      language: "javascript",
      test: "console.assert(binarySearch([1,2,3,4,5], 3) === 2, 'test 1')\nconsole.assert(binarySearch([1,2,3,4,5], 6) === -1, 'test 2')\nconsole.assert(binarySearch([1,2,3,4,5], 1) === 0, 'test 3')\nconsole.assert(binarySearch([], 1) === -1, 'test 4')\nconsole.log('All tests passed')",
    },
    difficulty: "medium",
  },
  {
    id: "c3",
    query: "Write a Python function called factorial that computes n factorial (n!). It should return 1 for n=0.",
    type: "coding",
    codingTest: {
      language: "python",
      test: "assert factorial(0) == 1\nassert factorial(1) == 1\nassert factorial(5) == 120\nassert factorial(10) == 3628800\nprint('All tests passed')",
    },
    difficulty: "easy",
  },
  {
    id: "c4",
    query: "Write a JavaScript function called isPalindrome that checks if a string reads the same forwards and backwards. Ignore case and spaces.",
    type: "coding",
    codingTest: {
      language: "javascript",
      test: "console.assert(isPalindrome('racecar') === true, 'test 1')\nconsole.assert(isPalindrome('hello') === false, 'test 2')\nconsole.assert(isPalindrome('A man a plan a canal Panama') === true, 'test 3')\nconsole.assert(isPalindrome('') === true, 'test 4')\nconsole.log('All tests passed')",
    },
    difficulty: "medium",
  },
  {
    id: "c5",
    query: "Write a Python function called fibonacci that returns the nth Fibonacci number. fib(0)=0, fib(1)=1.",
    type: "coding",
    codingTest: {
      language: "python",
      test: "assert fibonacci(0) == 0\nassert fibonacci(1) == 1\nassert fibonacci(2) == 1\nassert fibonacci(10) == 55\nassert fibonacci(20) == 6765\nprint('All tests passed')",
    },
    difficulty: "medium",
  },

  // ===== Factual queries (5) =====
  {
    id: "f1",
    query: "What is the capital of France?",
    type: "factual",
    expectedKeywords: ["Paris"],
    difficulty: "easy",
  },
  {
    id: "f2",
    query: "What is the speed of light in vacuum?",
    type: "factual",
    expectedKeywords: ["299,792"],
    difficulty: "easy",
  },
  {
    id: "f3",
    query: "Who wrote the play Hamlet?",
    type: "factual",
    expectedKeywords: ["Shakespeare"],
    difficulty: "easy",
  },
  {
    id: "f4",
    query: "What is the chemical symbol for gold?",
    type: "factual",
    expectedKeywords: ["Au"],
    difficulty: "easy",
  },
  {
    id: "f5",
    query: "What year did World War 2 end?",
    type: "factual",
    expectedKeywords: ["1945"],
    difficulty: "easy",
  },
];

export function getEvalQuery(id: string): EvalQuery | undefined {
  return EVAL_DATASET.find((q) => q.id === id);
}

export function getEvalQueriesByType(type: EvalQueryType): EvalQuery[] {
  return EVAL_DATASET.filter((q) => q.type === type);
}
