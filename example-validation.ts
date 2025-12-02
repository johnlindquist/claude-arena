/**
 * Example usage of the Form Validation System
 * Run with: bun example-validation.ts
 */

import {
  validateRegistrationForm,
  validateField,
  validateSingleFieldWithErrors,
  getFieldErrorMessages,
  type ValidRegistrationForm,
} from "./src/validation";

console.log("=".repeat(70));
console.log("Form Validation System - Examples");
console.log("=".repeat(70));

// ============================================================================
// Example 1: Full Form Validation - Success Case
// ============================================================================

console.log("\n1️⃣  Full Form Validation (Valid Data)\n");

const validFormData = {
  email: "alice@example.com",
  password: "myPassword123",
  confirmPassword: "myPassword123",
  age: 28,
  role: "admin" as const,
};

const result1 = validateRegistrationForm(validFormData);

if (result1.success) {
  console.log("✓ Validation successful!");
  console.log("Validated data:", result1.data);
  console.log(`  • Email: ${result1.data.email}`);
  console.log(`  • Password: ${result1.data.password.substring(0, 1)}${"*".repeat(result1.data.password.length - 1)}`);
  console.log(`  • Age: ${result1.data.age}`);
  console.log(`  • Role: ${result1.data.role}`);
} else {
  console.log("✗ Validation failed:", result1.errors);
}

// ============================================================================
// Example 2: Full Form Validation - Failure Case
// ============================================================================

console.log("\n\n2️⃣  Full Form Validation (Invalid Data)\n");

const invalidFormData = {
  email: "invalid-email",
  password: "weak",
  confirmPassword: "different",
  age: 15,
  role: "superadmin",
};

const result2 = validateRegistrationForm(invalidFormData);

if (!result2.success) {
  console.log("✓ Validation correctly rejected the form");
  console.log(`Found ${result2.errors.length} validation errors:\n`);
  result2.errors.forEach((error) => {
    console.log(`  • ${error.field}: ${error.message}`);
  });
} else {
  console.log("Data:", result2.data);
}

// ============================================================================
// Example 3: Single Field Validation (Real-time)
// ============================================================================

console.log("\n\n3️⃣  Single Field Validation (Real-time Input)\n");

const fieldTests = [
  { field: "email" as const, value: "user@example.com", description: "Valid email" },
  { field: "email" as const, value: "not-an-email", description: "Invalid email" },
  { field: "password" as const, value: "password123", description: "Valid password" },
  { field: "password" as const, value: "weak", description: "Weak password" },
  { field: "role" as const, value: "user", description: "Valid role" },
  { field: "role" as const, value: "guest", description: "Invalid role" },
];

fieldTests.forEach(({ field, value, description }) => {
  const result = validateField(field, value, { password: "password123" });
  const status = result.success ? "✓" : "✗";
  const message = result.success ? "Valid" : result.message;
  console.log(`${status} ${description}: ${message}`);
});

// ============================================================================
// Example 4: Optional Age Field
// ============================================================================

console.log("\n\n4️⃣  Optional Age Field\n");

const formsWithOptionalAge = [
  {
    email: "user1@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "user" as const,
    description: "No age provided",
  },
  {
    email: "user2@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 25,
    role: "user" as const,
    description: "Age: 25",
  },
  {
    email: "user3@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 17,
    role: "user" as const,
    description: "Age: 17 (too young)",
  },
];

formsWithOptionalAge.forEach(({ description, ...form }) => {
  const result = validateRegistrationForm(form);
  if (result.success) {
    const ageText = result.data.age ? `age ${result.data.age}` : "no age provided";
    console.log(`✓ ${description}: Valid (${ageText})`);
  } else {
    const ageError = result.errors.find((e) => e.field === "age");
    if (ageError) {
      console.log(`✗ ${description}: ${ageError.message}`);
    } else {
      console.log(`✓ ${description}: Valid`);
    }
  }
});

// ============================================================================
// Example 5: Type-Safe Data Access
// ============================================================================

console.log("\n\n5️⃣  Type-Safe Data Access (Discriminated Union)\n");

function processUserRegistration(formData: unknown): void {
  const result = validateRegistrationForm(formData);

  // Discriminated union ensures type safety
  if (result.success) {
    // Inside this block, result.data has type ValidRegistrationForm
    const user: ValidRegistrationForm = result.data;
    console.log("User registered successfully:");
    console.log(`  • Email: ${user.email}`);
    console.log(`  • Role: ${user.role}`);
    console.log(`  • Age: ${user.age || "Not provided"}`);
  } else {
    // Inside this block, result.errors has type FieldError[]
    console.log("Validation failed with the following errors:");
    result.errors.forEach((err) => {
      console.log(`  • [${err.field}] ${err.message}`);
    });
  }
}

console.log("Processing valid form:");
processUserRegistration({
  email: "bob@example.com",
  password: "securePass456",
  confirmPassword: "securePass456",
  role: "user",
});

console.log("\nProcessing invalid form:");
processUserRegistration({
  email: "invalid",
  password: "short",
  confirmPassword: "short",
  role: "invalid",
});

// ============================================================================
// Example 6: Field-Level Validation Helper
// ============================================================================

console.log("\n\n6️⃣  Field-Level Validation Helper\n");

const emailResult = validateSingleFieldWithErrors("email", "invalid-email");
console.log("Validating email field 'invalid-email':");
console.log(`  isValid: ${emailResult.isValid}`);
emailResult.errors.forEach((err) => {
  console.log(`  error: ${err.message}`);
});

console.log("\nValidating email field 'user@example.com':");
const emailResult2 = validateSingleFieldWithErrors("email", "user@example.com");
console.log(`  isValid: ${emailResult2.isValid}`);

// ============================================================================
// Example 7: Get Error Messages for a Field
// ============================================================================

console.log("\n\n7️⃣  Get Error Messages for a Specific Field\n");

const passwordErrors = getFieldErrorMessages("password", { password: "weak" });
console.log("Error messages for 'weak' password:");
passwordErrors.forEach((msg) => console.log(`  • ${msg}`));

const emailErrors = getFieldErrorMessages("email", { email: "invalid.com" });
console.log("\nError messages for 'invalid.com' email:");
emailErrors.forEach((msg) => console.log(`  • ${msg}`));

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("Key Features Demonstrated:");
console.log("=".repeat(70));
console.log(`
✓ Full form validation with discriminated unions (success | failure)
✓ Field-specific error messages with field names
✓ Optional fields (age is optional, others required)
✓ Single field validation for real-time feedback
✓ Type-safe data access using discriminated unions
✓ Helper functions for field-level error handling
✓ Proper error handling for invalid inputs
✓ Support for complex validation rules (password strength, age range, etc.)
`);
