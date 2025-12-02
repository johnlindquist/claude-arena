/**
 * Simple test runner for validation module
 * Run with: bun test-validation.ts
 */

import {
  validateRegistrationForm,
  validateField,
  type ValidRegistrationForm,
} from "./src/validation";

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

// ============================================================================
// Tests
// ============================================================================

console.log("Testing Form Validation System\n");

// Valid forms
test("accepts a complete valid form", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 25,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
  if (result.success) {
    assertEquals(result.data.email, "user@example.com");
    assertEquals(result.data.age, 25);
  }
});

test("accepts form without optional age field", () => {
  const form = {
    email: "admin@example.com",
    password: "securePassword456",
    confirmPassword: "securePassword456",
    role: "admin" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
  if (result.success) {
    assert(result.data.age === undefined, "Expected age to be undefined");
  }
});

test("accepts age boundary value 18", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 18,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
  if (result.success) {
    assertEquals(result.data.age, 18);
  }
});

test("accepts age boundary value 120", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 120,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
  if (result.success) {
    assertEquals(result.data.age, 120);
  }
});

test("accepts null/undefined age as optional", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: null,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
  if (result.success) {
    assert(result.data.age === undefined, "Expected age to be undefined");
  }
});

// Email validation
test("rejects missing email", () => {
  const form = {
    password: "password123",
    confirmPassword: "password123",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    assert(
      result.errors.some((e) => e.field === "email"),
      "Expected email error"
    );
  }
});

test("rejects invalid email format", () => {
  const form = {
    email: "invalid.email.com",
    password: "password123",
    confirmPassword: "password123",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const emailError = result.errors.find((e) => e.field === "email");
    assert(emailError !== undefined, "Expected email error");
  }
});

// Password validation
test("rejects password shorter than 8 characters", () => {
  const form = {
    email: "user@example.com",
    password: "pass123",
    confirmPassword: "pass123",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const pwError = result.errors.find((e) => e.field === "password");
    assert(pwError !== undefined, "Expected password error");
    assert(
      pwError.message.includes("8 characters"),
      "Expected length error message"
    );
  }
});

test("rejects password without number", () => {
  const form = {
    email: "user@example.com",
    password: "password",
    confirmPassword: "password",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const pwError = result.errors.find((e) => e.field === "password");
    assert(pwError !== undefined, "Expected password error");
    assert(
      pwError.message.includes("number"),
      "Expected number requirement error"
    );
  }
});

test("accepts password with exactly 8 characters and one number", () => {
  const form = {
    email: "user@example.com",
    password: "password1",
    confirmPassword: "password1",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
});

// ConfirmPassword validation
test("rejects when confirmPassword does not match password", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "different456",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const confirmError = result.errors.find((e) => e.field === "confirmPassword");
    assert(confirmError !== undefined, "Expected confirmPassword error");
    assert(confirmError.message.includes("match"), "Expected match error");
  }
});

// Age validation
test("rejects age below 18", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 17,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const ageError = result.errors.find((e) => e.field === "age");
    assert(ageError !== undefined, "Expected age error");
  }
});

test("rejects age above 120", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 121,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const ageError = result.errors.find((e) => e.field === "age");
    assert(ageError !== undefined, "Expected age error");
  }
});

test("rejects non-integer age", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 25.5,
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const ageError = result.errors.find((e) => e.field === "age");
    assert(ageError !== undefined, "Expected age error");
    assert(ageError.message.includes("whole number"), "Expected integer error");
  }
});

// Role validation
test("rejects role other than admin or user", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "superadmin",
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    const roleError = result.errors.find((e) => e.field === "role");
    assert(roleError !== undefined, "Expected role error");
  }
});

test("accepts role admin", () => {
  const form = {
    email: "admin@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "admin" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
});

test("accepts role user", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "user" as const,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
});

// Multiple errors
test("returns all field errors when multiple fields are invalid", () => {
  const form = {
    email: "invalid.email",
    password: "short",
    confirmPassword: "different",
    age: 15,
    role: "invalid",
  };

  const result = validateRegistrationForm(form);
  assert(result.success === false, "Expected success: false");
  if (!result.success) {
    assert(result.errors.length === 5, `Expected 5 errors, got ${result.errors.length}`);
  }
});

// Single field validation
test("validateField validates email", () => {
  const result = validateField("email", "user@example.com");
  assert(result.success === true, "Expected valid email");
});

test("validateField rejects invalid email", () => {
  const result = validateField("email", "invalid.email");
  assert(result.success === false, "Expected invalid email");
  if (!result.success) {
    assert(result.message.includes("valid"), "Expected format error message");
  }
});

test("validateField validates password", () => {
  const result = validateField("password", "password123");
  assert(result.success === true, "Expected valid password");
});

test("validateField validates confirmPassword with context", () => {
  const result = validateField("confirmPassword", "password123", {
    password: "password123",
  });
  assert(result.success === true, "Expected matching password");
});

test("validateField rejects non-matching confirmPassword", () => {
  const result = validateField("confirmPassword", "different", {
    password: "password123",
  });
  assert(result.success === false, "Expected mismatch");
  if (!result.success) {
    assert(result.message.includes("match"), "Expected match error");
  }
});

test("validateField validates role", () => {
  const result = validateField("role", "admin");
  assert(result.success === true, "Expected valid role");
});

test("validateField rejects invalid role", () => {
  const result = validateField("role", "superadmin");
  assert(result.success === false, "Expected invalid role");
});

test("handles extra fields gracefully", () => {
  const form = {
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "user" as const,
    extraField: "should be ignored",
    anotherField: 123,
  };

  const result = validateRegistrationForm(form);
  assert(result.success === true, "Expected success: true");
  if (result.success) {
    assert(!("extraField" in result.data), "Should not have extraField");
  }
});

// ============================================================================
// Results
// ============================================================================

console.log(`\n${"─".repeat(50)}`);
console.log(`Tests: ${passCount}/${testCount} passed, ${failCount} failed`);
if (failCount === 0) {
  console.log("✓ All tests passed!");
  process.exit(0);
} else {
  console.log(`✗ ${failCount} test(s) failed`);
  process.exit(1);
}
