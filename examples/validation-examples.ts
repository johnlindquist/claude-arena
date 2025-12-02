/**
 * Comprehensive examples demonstrating the form validation system
 */

import {
  validateRegistrationForm,
  validateField,
} from "../src/validation";
import type { ValidationResult, ValidRegistrationForm } from "../src/validation";

// ============================================================================
// Example 1: Successful Form Validation
// ============================================================================

console.log("\n--- Example 1: Successful Form Validation ---");

const validUserForm = {
  email: "alice@example.com",
  password: "SecurePass123",
  confirmPassword: "SecurePass123",
  role: "user",
};

const result1 = validateRegistrationForm(validUserForm);

if (result1.success) {
  console.log("✓ Form is valid!");
  console.log("Validated data:", result1.data);
  // TypeScript knows result1.data exists here
  const { email, password, role } = result1.data;
  console.log(`User: ${email} with role: ${role}`);
} else {
  console.log("✗ Form has errors");
}

// ============================================================================
// Example 2: Form Validation with Optional Age
// ============================================================================

console.log("\n--- Example 2: Form with Optional Age Field ---");

const adminFormWithAge = {
  email: "admin@company.com",
  password: "AdminPass456",
  confirmPassword: "AdminPass456",
  age: 35,
  role: "admin" as const,
};

const result2 = validateRegistrationForm(adminFormWithAge);

if (result2.success) {
  console.log("✓ Admin registration valid!");
  if (result2.data.age) {
    console.log(`Age verified: ${result2.data.age} years old`);
  }
} else {
  console.log("✗ Validation failed");
  result2.errors.forEach((err) => {
    console.log(`  ${err.field}: ${err.message}`);
  });
}

// ============================================================================
// Example 3: Handling Validation Errors
// ============================================================================

console.log("\n--- Example 3: Handling Validation Errors ---");

const invalidForm = {
  email: "not-an-email",
  password: "weak",
  confirmPassword: "different",
  role: "superuser",
};

const result3 = validateRegistrationForm(invalidForm);

if (!result3.success) {
  console.log("✗ Form validation failed with errors:");
  // TypeScript knows result3.errors exists here
  result3.errors.forEach((error) => {
    console.log(`  - ${error.field}: ${error.message}`);
  });
}

// ============================================================================
// Example 4: Real-time Single Field Validation
// ============================================================================

console.log("\n--- Example 4: Real-time Field Validation ---");

// User is typing their email
const emailValidations = [
  "u",
  "us",
  "user",
  "user@",
  "user@example",
  "user@example.com",
];

console.log("Email field validation as user types:");
emailValidations.forEach((email) => {
  const result = validateField("email", email);
  const status = result.success ? "✓ valid" : `✗ ${result.message}`;
  console.log(`  "${email}" → ${status}`);
});

// ============================================================================
// Example 5: Password Matching Validation
// ============================================================================

console.log("\n--- Example 5: Password Confirmation Field ---");

const password = "MyPassword789";

// Validate confirm password with context
const confirmResult1 = validateField("confirmPassword", "MyPassword789", {
  password,
});
console.log("Matching password:", confirmResult1);

const confirmResult2 = validateField("confirmPassword", "DifferentPass", {
  password,
});
console.log("Mismatched password:", confirmResult2);

// ============================================================================
// Example 6: Age Validation Edge Cases
// ============================================================================

console.log("\n--- Example 6: Age Validation Edge Cases ---");

const ageTests = [
  { age: 17, expected: "too young" },
  { age: 18, expected: "valid minimum" },
  { age: 50, expected: "valid" },
  { age: 120, expected: "valid maximum" },
  { age: 121, expected: "too old" },
];

console.log("Age field validation:");
ageTests.forEach(({ age, expected }) => {
  const result = validateField("age", age);
  const status = result.success ? "✓" : "✗";
  console.log(`  age ${age} (${expected}): ${status}`);
});

// ============================================================================
// Example 7: Role Validation
// ============================================================================

console.log("\n--- Example 7: Role Validation ---");

const roles = ["admin", "user", "moderator", "guest"];

console.log("Role field validation:");
roles.forEach((role) => {
  const result = validateField("role", role);
  const status = result.success ? "✓ valid" : `✗ invalid`;
  console.log(`  "${role}": ${status}`);
});

// ============================================================================
// Example 8: Type-Safe Result Handling Pattern
// ============================================================================

console.log("\n--- Example 8: Type-Safe Result Handling ---");

function processRegistration(formData: unknown): string {
  const result = validateRegistrationForm(formData);

  // Discriminated union ensures we handle both cases
  if (result.success) {
    // Here, TypeScript knows we have .data
    return `Successfully registered ${result.data.email} as ${result.data.role}`;
  } else {
    // Here, TypeScript knows we have .errors
    const errorMessages = result.errors
      .map((e) => `${e.field}: ${e.message}`)
      .join(", ");
    return `Registration failed: ${errorMessages}`;
  }
}

const testForm1 = {
  email: "test@example.com",
  password: "TestPass123",
  confirmPassword: "TestPass123",
  role: "user",
};

const testForm2 = {
  email: "invalid",
  password: "short",
};

console.log(processRegistration(testForm1));
console.log(processRegistration(testForm2));

// ============================================================================
// Example 9: Form Building with Partial Data
// ============================================================================

console.log("\n--- Example 9: Progressive Form Completion ---");

// Simulating a multi-step form
const step1 = {
  email: "john@example.com",
  password: "StepOne1",
  confirmPassword: "StepOne1",
};

const step2 = {
  ...step1,
  role: "admin" as const,
};

const step3 = {
  ...step2,
  age: 28,
};

console.log("After step 1 (email & password):");
console.log(validateRegistrationForm(step1));

console.log("\nAfter step 2 (add role):");
console.log(validateRegistrationForm(step2));

console.log("\nAfter step 3 (add optional age):");
const finalResult = validateRegistrationForm(step3);
if (finalResult.success) {
  console.log("✓ Registration complete!");
  console.log("Data:", finalResult.data);
}

// ============================================================================
// Example 10: Extracting and Using Validated Data
// ============================================================================

console.log("\n--- Example 10: Safe Data Extraction ---");

const rawData = {
  email: "user@company.com",
  password: "Company@2024",
  confirmPassword: "Company@2024",
  age: 32,
  role: "user",
};

const validationResult = validateRegistrationForm(rawData);

if (validationResult.success) {
  // Destructure from validated data - completely type-safe
  const { email, password, confirmPassword, age, role } =
    validationResult.data;

  console.log(`
    Registration Data:
    - Email: ${email}
    - Password: ${password.substring(0, 3)}...
    - Role: ${role}
    - Age: ${age ?? "not provided"}
  `);

  // The type system ensures we can't access invalid fields
  // validationResult.data.errors would be a compile error
} else {
  // Handle errors array
  validationResult.errors.forEach((error) => {
    console.error(`Field ${error.field}: ${error.message}`);
  });
}

// ============================================================================
// Summary
// ============================================================================

console.log("\n--- VALIDATION SYSTEM FEATURES ---");
console.log("✓ Discriminated unions for type-safe results");
console.log("✓ Full form validation with field-specific errors");
console.log("✓ Single-field validation for real-time feedback");
console.log("✓ Optional field support (age)");
console.log("✓ Type-safe data access after validation");
console.log("✓ Comprehensive error messages");
console.log("✓ Email format validation with regex");
console.log("✓ Password strength requirements (8+ chars, 1+ number)");
console.log("✓ Password confirmation matching");
console.log("✓ Age range validation (18-120)");
console.log("✓ Role enum enforcement (admin|user)");
