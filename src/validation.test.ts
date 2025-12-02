import {
  validateRegistrationForm,
  validateField,
  type ValidRegistrationForm,
} from "./validation";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(` ${name}`);
  } catch (error) {
    console.error(` ${name}`);
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
    process.exit(1);
  }
}

console.log("\n=Ë Full Form Validation Tests\n");

test("should validate a complete valid form", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "secure123",
    confirmPassword: "secure123",
    age: 25,
    role: "user",
  });
  if (!result.success) throw new Error("Should validate");
});

test("should validate form without optional age field", () => {
  const result = validateRegistrationForm({
    email: "admin@example.com",
    password: "password456",
    confirmPassword: "password456",
    role: "admin",
  });
  if (!result.success) throw new Error("Should validate");
  if (result.data.age !== undefined) throw new Error("Age should be undefined");
});

test("should fail when email is missing", () => {
  const result = validateRegistrationForm({
    password: "password123",
    confirmPassword: "password123",
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should fail when email is invalid format", () => {
  const result = validateRegistrationForm({
    email: "not-an-email",
    password: "password123",
    confirmPassword: "password123",
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should fail when password is too short", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "pass12",
    confirmPassword: "pass12",
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should fail when password has no number", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "passwordabc",
    confirmPassword: "passwordabc",
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should fail when confirmPassword doesn't match password", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password456",
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should fail when age is below 18", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 17,
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should fail when age is above 120", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 150,
    role: "user",
  });
  if (result.success) throw new Error("Should fail");
});

test("should accept age of 18 (boundary)", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 18,
    role: "user",
  });
  if (!result.success) throw new Error("Should validate");
});

test("should accept age of 120 (boundary)", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    age: 120,
    role: "user",
  });
  if (!result.success) throw new Error("Should validate");
});

test("should fail when role is invalid value", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "superadmin",
  });
  if (result.success) throw new Error("Should fail");
});

test("should accept role of 'admin'", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "admin",
  });
  if (!result.success) throw new Error("Should validate");
});

test("should report multiple errors at once", () => {
  const result = validateRegistrationForm({
    email: "invalid-email",
    password: "short1",
    confirmPassword: "different2",
    age: 200,
    role: "moderator",
  });
  if (result.success) throw new Error("Should fail");
  if (!result.errors || result.errors.length < 3) throw new Error("Expected multiple errors");
});

console.log("\n<¯ Single Field Validation Tests\n");

test("should validate email field independently", () => {
  const valid = validateField("email", "user@example.com");
  const invalid = validateField("email", "not-an-email");
  if (!valid.success || invalid.success) throw new Error("Email validation failed");
});

test("should validate password field independently", () => {
  const valid = validateField("password", "password123");
  const invalid = validateField("password", "weak");
  if (!valid.success || invalid.success) throw new Error("Password validation failed");
});

test("should validate confirmPassword with context", () => {
  const valid = validateField("confirmPassword", "password123", {
    password: "password123",
  });
  const invalid = validateField("confirmPassword", "password456", {
    password: "password123",
  });
  if (!valid.success || invalid.success) throw new Error("Confirm password validation failed");
});

test("should validate role field independently", () => {
  const validAdmin = validateField("role", "admin");
  const validUser = validateField("role", "user");
  const invalid = validateField("role", "guest");
  if (!validAdmin.success || !validUser.success || invalid.success)
    throw new Error("Role validation failed");
});

test("should validate age field independently", () => {
  const valid = validateField("age", 30);
  const invalid = validateField("age", 15);
  const optional = validateField("age", undefined);
  if (!valid.success || invalid.success || !optional.success)
    throw new Error("Age validation failed");
});

console.log("\n=' Edge Cases\n");

test("should handle non-object input gracefully", () => {
  const result = validateRegistrationForm("not an object" as any);
  if (result.success) throw new Error("Should fail");
});

test("should handle null input gracefully", () => {
  const result = validateRegistrationForm(null as any);
  if (result.success) throw new Error("Should fail");
});

test("should handle form with extra fields (ignored)", () => {
  const result = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "user",
    extraField: "should be ignored",
  } as any);
  if (!result.success) throw new Error("Should validate");
});

test("should discriminate between success: true and success: false", () => {
  const validResult = validateRegistrationForm({
    email: "user@example.com",
    password: "password123",
    confirmPassword: "password123",
    role: "user",
  });

  if (validResult.success) {
    const email: string = validResult.data.email;
    const role: "admin" | "user" = validResult.data.role;
  } else {
    throw new Error("Expected valid result");
  }
});

console.log("\n All validation tests passed!\n");
console.log("The form validation system correctly:");
console.log("  - Validates email format");
console.log("  - Enforces password requirements (8+ chars, at least one number)");
console.log("  - Matches password confirmation");
console.log("  - Validates age (18-120, optional)");
console.log("  - Restricts role to 'admin' or 'user'");
console.log("  - Handles missing and invalid fields");
console.log("  - Supports single-field validation");
console.log("  - Returns clear success/failure states");
