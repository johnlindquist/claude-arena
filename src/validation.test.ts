import { describe, expect, it } from "vitest";
import { type ValidRegistrationForm, validateField, validateRegistrationForm } from "./validation";

describe("Full Form Validation", () => {
	it("should validate a complete valid form", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "secure123",
			confirmPassword: "secure123",
			age: 25,
			role: "user",
		});
		expect(result.success).toBe(true);
	});

	it("should validate form without optional age field", () => {
		const result = validateRegistrationForm({
			email: "admin@example.com",
			password: "password456",
			confirmPassword: "password456",
			role: "admin",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.age).toBeUndefined();
		}
	});

	it("should fail when email is missing", () => {
		const result = validateRegistrationForm({
			password: "password123",
			confirmPassword: "password123",
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should fail when email is invalid format", () => {
		const result = validateRegistrationForm({
			email: "not-an-email",
			password: "password123",
			confirmPassword: "password123",
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should fail when password is too short", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "pass12",
			confirmPassword: "pass12",
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should fail when password has no number", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "passwordabc",
			confirmPassword: "passwordabc",
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should fail when confirmPassword doesn't match password", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password456",
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should fail when age is below 18", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			age: 17,
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should fail when age is above 120", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			age: 150,
			role: "user",
		});
		expect(result.success).toBe(false);
	});

	it("should accept age of 18 (boundary)", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			age: 18,
			role: "user",
		});
		expect(result.success).toBe(true);
	});

	it("should accept age of 120 (boundary)", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			age: 120,
			role: "user",
		});
		expect(result.success).toBe(true);
	});

	it("should fail when role is invalid value", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			role: "superadmin",
		});
		expect(result.success).toBe(false);
	});

	it("should accept role of 'admin'", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			role: "admin",
		});
		expect(result.success).toBe(true);
	});

	it("should report multiple errors at once", () => {
		const result = validateRegistrationForm({
			email: "invalid-email",
			password: "short1",
			confirmPassword: "different2",
			age: 200,
			role: "moderator",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBeGreaterThanOrEqual(3);
		}
	});
});

describe("Single Field Validation", () => {
	it("should validate email field independently", () => {
		const valid = validateField("email", "user@example.com");
		const invalid = validateField("email", "not-an-email");
		expect(valid.success).toBe(true);
		expect(invalid.success).toBe(false);
	});

	it("should validate password field independently", () => {
		const valid = validateField("password", "password123");
		const invalid = validateField("password", "weak");
		expect(valid.success).toBe(true);
		expect(invalid.success).toBe(false);
	});

	it("should validate confirmPassword with context", () => {
		const valid = validateField("confirmPassword", "password123", {
			password: "password123",
		});
		const invalid = validateField("confirmPassword", "password456", {
			password: "password123",
		});
		expect(valid.success).toBe(true);
		expect(invalid.success).toBe(false);
	});

	it("should validate role field independently", () => {
		const validAdmin = validateField("role", "admin");
		const validUser = validateField("role", "user");
		const invalid = validateField("role", "guest");
		expect(validAdmin.success).toBe(true);
		expect(validUser.success).toBe(true);
		expect(invalid.success).toBe(false);
	});

	it("should validate age field independently", () => {
		const valid = validateField("age", 30);
		const invalid = validateField("age", 15);
		const optional = validateField("age", undefined);
		expect(valid.success).toBe(true);
		expect(invalid.success).toBe(false);
		expect(optional.success).toBe(true);
	});
});

describe("Edge Cases", () => {
	it("should handle non-object input gracefully", () => {
		const result = validateRegistrationForm("not an object" as any);
		expect(result.success).toBe(false);
	});

	it("should handle null input gracefully", () => {
		const result = validateRegistrationForm(null as any);
		expect(result.success).toBe(false);
	});

	it("should handle form with extra fields (ignored)", () => {
		const result = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			role: "user",
			extraField: "should be ignored",
		} as any);
		expect(result.success).toBe(true);
	});

	it("should discriminate between success: true and success: false", () => {
		const validResult = validateRegistrationForm({
			email: "user@example.com",
			password: "password123",
			confirmPassword: "password123",
			role: "user",
		});

		expect(validResult.success).toBe(true);
		if (validResult.success) {
			const email: string = validResult.data.email;
			const role: "admin" | "user" = validResult.data.role;
			expect(typeof email).toBe("string");
			expect(["admin", "user"]).toContain(role);
		}
	});
});
