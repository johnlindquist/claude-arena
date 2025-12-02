/**
 * Example usage of the form validation system
 */

import {
  validateRegistrationForm,
  validateField,
  validateSingleFieldWithErrors,
  getFieldErrorMessages,
  type RegistrationForm,
  type ValidationResult,
} from "./validation";

// ============================================================================
// Example 1: Validate the entire form
// ============================================================================

const validForm: RegistrationForm = {
  email: "user@example.com",
  password: "MyPassword123",
  confirmPassword: "MyPassword123",
  age: 25,
  role: "admin",
};

const result = validateRegistrationForm(validForm);
console.log("Valid form result:", result);
// Output: { success: true, data: { email: "user@example.com", ... } }

// ============================================================================
// Example 2: Invalid form - missing required field
// ============================================================================

const invalidForm: RegistrationForm = {
  email: "invalid-email",
  password: "short", // Too short
  confirmPassword: "different",
  role: "superuser", // Invalid role
};

const result2 = validateRegistrationForm(invalidForm);
console.log("Invalid form result:", result2);
// Output: { success: false, errors: [ ... ] }

if (!result2.success) {
  console.log("Errors:", result2.errors);
  // Output: [
  //   { field: "email", message: "Email must be in valid format..." },
  //   { field: "password", message: "Password must be at least 8 characters..." },
  //   { field: "confirmPassword", message: "Confirm password must match password" },
  //   { field: "role", message: 'Role must be either "admin" or "user"' }
  // ]
}

// ============================================================================
// Example 3: Single-field validation (real-time as user types)
// ============================================================================

const emailValidation = validateField("email", "user@example.com");
console.log("Email validation:", emailValidation);
// Output: { success: true }

const passwordValidation = validateField("password", "weak");
console.log("Password validation:", passwordValidation);
// Output: { success: false, message: "Password must be at least 8 characters long" }

// ============================================================================
// Example 4: Cross-field validation (confirmPassword depends on password)
// ============================================================================

const formData: RegistrationForm = {
  password: "MyPassword123",
};

const confirmPasswordValidation = validateField("confirmPassword", "DifferentPassword", {
  password: formData.password,
});
console.log("ConfirmPassword validation:", confirmPasswordValidation);
// Output: { success: false, message: "Confirm password must match password" }

const confirmPasswordValidation2 = validateField("confirmPassword", "MyPassword123", {
  password: formData.password,
});
console.log("ConfirmPassword validation (correct):", confirmPasswordValidation2);
// Output: { success: true }

// ============================================================================
// Example 5: Using validateSingleFieldWithErrors (detailed error info)
// ============================================================================

const emailErrors = validateSingleFieldWithErrors("email", "invalid-email");
console.log("Email errors:", emailErrors);
// Output: { isValid: false, errors: [{ field: "email", message: "..." }] }

// ============================================================================
// Example 6: Getting all error messages for a field
// ============================================================================

const formWithInvalidAge: RegistrationForm = {
  age: 15, // Too young
};

const ageErrorMessages = getFieldErrorMessages("age", formWithInvalidAge);
console.log("Age error messages:", ageErrorMessages);
// Output: ["Age must be between 18 and 120"]

// ============================================================================
// Example 7: Optional age field - validation succeeds when not provided
// ============================================================================

const formWithoutAge: RegistrationForm = {
  email: "user@example.com",
  password: "MyPassword123",
  confirmPassword: "MyPassword123",
  role: "user",
};

const resultNoAge = validateRegistrationForm(formWithoutAge);
console.log("Form without age:", resultNoAge);
// Output: { success: true, data: { email: "...", role: "user", age: undefined } }

// ============================================================================
// Example 8: All validation error scenarios
// ============================================================================

const testCases: Array<{ name: string; form: RegistrationForm }> = [
  {
    name: "Missing email",
    form: { password: "Pass123", confirmPassword: "Pass123", role: "user" },
  },
  {
    name: "Invalid email format",
    form: { email: "not-an-email", password: "Pass123", confirmPassword: "Pass123", role: "user" },
  },
  {
    name: "Password too short",
    form: { email: "user@example.com", password: "Pass1", confirmPassword: "Pass1", role: "user" },
  },
  {
    name: "Password missing number",
    form: { email: "user@example.com", password: "Password", confirmPassword: "Password", role: "user" },
  },
  {
    name: "Passwords don't match",
    form: {
      email: "user@example.com",
      password: "Password123",
      confirmPassword: "Password456",
      role: "user",
    },
  },
  {
    name: "Age out of range",
    form: {
      email: "user@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      age: 150,
      role: "user",
    },
  },
  {
    name: "Invalid role",
    form: {
      email: "user@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      role: "moderator",
    },
  },
];

testCases.forEach(({ name, form }) => {
  const validation = validateRegistrationForm(form);
  console.log(`\n${name}:`);
  if (!validation.success) {
    validation.errors.forEach((error) => {
      console.log(`  - ${error.field}: ${error.message}`);
    });
  } else {
    console.log("  ✓ Valid");
  }
});
