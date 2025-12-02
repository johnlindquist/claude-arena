/**
 * Form Validation System - Usage Examples
 *
 * This file demonstrates practical usage patterns for the form validation module.
 */

import {
  validateRegistrationForm,
  validateField,
  type RawRegistrationForm,
  type ValidationResult
} from "./formValidation";

/**
 * Example 1: Validating a complete form with all fields
 */
export function example1_ValidateCompleteForm() {
  const userInput: RawRegistrationForm = {
    email: "alice@example.com",
    password: "MySecurePass123",
    confirmPassword: "MySecurePass123",
    age: 28,
    role: "user"
  };

  const result = validateRegistrationForm(userInput);

  if (result.success) {
    console.log("✓ Form is valid!");
    console.log("User email:", result.data.email);
    console.log("User role:", result.data.role);
    // Safe to use result.data - all fields are guaranteed valid
  } else {
    console.log("✗ Form has errors:");
    Object.entries(result.errors).forEach(([field, fieldErrors]) => {
      if (fieldErrors.length > 0) {
        console.log(`  ${field}:`, fieldErrors);
      }
    });
  }
}

/**
 * Example 2: Validating a form without optional age field
 */
export function example2_ValidateWithoutOptionalField() {
  const userInput: RawRegistrationForm = {
    email: "bob@example.com",
    password: "AnotherPass456",
    confirmPassword: "AnotherPass456",
    role: "admin"
    // age is omitted - this is valid since age is optional
  };

  const result = validateRegistrationForm(userInput);

  if (result.success) {
    console.log("✓ Form is valid without age!");
    console.log("Age provided:", result.data.age); // undefined
  }
}

/**
 * Example 3: Single field validation for real-time feedback
 * (e.g., as user types in an email input)
 */
export function example3_RealTimeEmailValidation() {
  const emailInputs = [
    "user",           // incomplete
    "user@",          // missing domain
    "user@example",   // missing TLD
    "user@example.com" // valid
  ];

  emailInputs.forEach((email) => {
    const errors = validateField("email", email);
    console.log(`Email "${email}":`, errors.length === 0 ? "✓ valid" : errors);
  });
}

/**
 * Example 4: Single field validation for password with context
 */
export function example4_PasswordMatchValidation() {
  const password = "SecurePass123";
  const confirmPassword1 = "SecurePass123";
  const confirmPassword2 = "DifferentPass123";

  const context = { password };

  const errors1 = validateField("confirmPassword", confirmPassword1, context);
  console.log(`Matching password:`, errors1.length === 0 ? "✓ valid" : errors1);

  const errors2 = validateField("confirmPassword", confirmPassword2, context);
  console.log(`Non-matching password:`, errors2.length === 0 ? "✓ valid" : errors2);
}

/**
 * Example 5: Handling invalid form input gracefully
 */
export function example5_InvalidInput() {
  // Form data might come from various sources (API, form submission, etc.)
  const inputs = [
    null,
    undefined,
    "not an object",
    [],
    {} // empty object
  ];

  inputs.forEach((input) => {
    const result = validateRegistrationForm(input as any);
    if (!result.success) {
      console.log(`Input ${JSON.stringify(input)}:`, Object.keys(result.errors).length, "errors");
    }
  });
}

/**
 * Example 6: Building form validation in a React-like component
 */
export function example6_FormComponent() {
  interface FormState extends RawRegistrationForm {
    touched?: Record<string, boolean>;
    errors?: Record<string, string[]>;
  }

  const formState: FormState = {
    email: "test@example.com",
    password: "weak",
    confirmPassword: "weak",
    age: 25,
    role: "user",
    touched: {
      email: true,
      password: true,
      confirmPassword: true
    }
  };

  // Validate the entire form
  const result = validateRegistrationForm(formState);

  if (!result.success) {
    // Store errors in state for rendering
    const fieldErrors = result.errors;

    // Only show errors for fields that have been touched by the user
    const visibleErrors: Record<string, string[]> = {};
    (Object.keys(fieldErrors) as Array<keyof typeof fieldErrors>).forEach((field) => {
      if (formState.touched?.[field]) {
        visibleErrors[field] = fieldErrors[field];
      }
    });

    console.log("Visible errors for touched fields:", visibleErrors);
  }
}

/**
 * Example 7: Validating individual fields as user types
 */
export function example7_FieldByFieldValidation() {
  const form: RawRegistrationForm = {
    email: "",
    password: "",
    confirmPassword: "",
    role: "user"
  };

  // Simulate user typing in email field
  console.log("=== Email field validation ===");
  form.email = "a";
  let errors = validateField("email", form.email);
  console.log("After typing 'a':", errors);

  form.email = "alice@";
  errors = validateField("email", form.email);
  console.log("After typing 'alice@':", errors);

  form.email = "alice@example.com";
  errors = validateField("email", form.email);
  console.log("After typing 'alice@example.com':", errors);

  // Simulate user typing in password field
  console.log("\n=== Password field validation ===");
  form.password = "weak";
  errors = validateField("password", form.password);
  console.log("Password 'weak':", errors);

  form.password = "StrongPass123";
  errors = validateField("password", form.password);
  console.log("Password 'StrongPass123':", errors);

  // Validate confirm password with context
  console.log("\n=== Confirm password field validation ===");
  form.confirmPassword = "DifferentPass456";
  errors = validateField("confirmPassword", form.confirmPassword, form);
  console.log("Confirm password different:", errors);

  form.confirmPassword = "StrongPass123";
  errors = validateField("confirmPassword", form.confirmPassword, form);
  console.log("Confirm password matching:", errors);
}

/**
 * Example 8: Age validation edge cases
 */
export function example8_AgeValidationEdgeCases() {
  const ages = [undefined, null, 17, 18, 120, 121, 25.5, "25"];

  ages.forEach((age) => {
    const errors = validateField("age", age);
    console.log(
      `Age ${JSON.stringify(age)}:`,
      errors.length === 0 ? "✓ valid" : errors
    );
  });
}

/**
 * Example 9: Role validation
 */
export function example9_RoleValidation() {
  const roles = ["admin", "user", "superadmin", "moderator", "", null];

  roles.forEach((role) => {
    const errors = validateField("role", role);
    console.log(
      `Role "${role}":`,
      errors.length === 0 ? "✓ valid" : errors
    );
  });
}

/**
 * Example 10: Handling form submission
 */
export function example10_FormSubmission(formData: unknown) {
  // Validation happens before form submission
  const result = validateRegistrationForm(formData);

  if (result.success) {
    // Form is valid - safe to submit to API
    console.log("Submitting valid form data:", {
      email: result.data.email,
      role: result.data.role,
      age: result.data.age // may be undefined
    });
    // In real application:
    // await api.registerUser(result.data);
  } else {
    // Form has validation errors - show to user
    console.log("Form submission blocked due to validation errors:");
    Object.entries(result.errors).forEach(([field, fieldErrors]) => {
      if (fieldErrors.length > 0) {
        console.log(`  ${field}: ${fieldErrors.join(", ")}`);
      }
    });
  }
}

/**
 * Example 11: Type-safe error handling
 */
export function example11_TypeSafeErrorHandling() {
  const result = validateRegistrationForm({
    email: "invalid",
    password: "weak",
    confirmPassword: "mismatched",
    role: "invalid"
  });

  if (!result.success) {
    // TypeScript knows result.errors has all field keys
    const emailErrors: string[] = result.errors.email;
    const passwordErrors: string[] = result.errors.password;
    const roleErrors: string[] = result.errors.role;

    // This would cause a TypeScript error (good!):
    // const unknownField = result.errors.unknownField;

    console.log("Email errors:", emailErrors);
    console.log("Password errors:", passwordErrors);
    console.log("Role errors:", roleErrors);
  } else {
    // TypeScript knows result.data is RegistrationForm with all fields valid
    const { email, password, role, age } = result.data;
    console.log("All fields are valid:", { email, password, role, age });
  }
}
