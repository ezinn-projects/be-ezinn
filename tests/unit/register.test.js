"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const messages_1 = require("~/constants/messages");
const users_middleware_1 = require("~/middlewares/users.middleware");
// import { USER_MESSAGES } from '../messages' // Đường dẫn tới các thông báo lỗi tùy chỉnh
// Mock Request và Response
const mockRequest = (body) => ({ body });
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
};
describe('Register Validator', () => {
    it('should fail validation for empty name', async () => {
        const req = mockRequest({
            name: '', // Tên rỗng
            email: 'valid@example.com',
            password: 'ValidPass123!',
            confirm_password: 'ValidPass123!',
            date_of_birth: '2024-09-04T09:18:23.364Z'
        });
        const res = mockResponse();
        // Chạy validator trực tiếp
        await (0, users_middleware_1.registerValidator)(req, res, jest.fn());
        // Lấy kết quả validation
        const errors = (0, express_validator_1.validationResult)(req);
        // Kiểm tra lỗi trường 'name'
        expect(errors.isEmpty()).toBe(false); // Phải có lỗi
        const error = errors.mapped(); // Trả về object chứa lỗi
        expect(error).toHaveProperty('name');
        expect(error.name.msg).toBe(messages_1.USER_MESSAGES.USERNAME_NOT_EMPTY);
    });
    it('should fail validation for invalid email', async () => {
        const req = mockRequest({
            name: 'Quang Do',
            email: 'invalid-email', // Email không hợp lệ
            password: 'ValidPass123!',
            confirm_password: 'ValidPass123!',
            date_of_birth: '2024-09-04T09:18:23.364Z'
        });
        const res = mockResponse();
        // Chạy validator trực tiếp
        await (0, users_middleware_1.registerValidator)(req, res, jest.fn());
        // Lấy kết quả validation
        const errors = (0, express_validator_1.validationResult)(req);
        // Kiểm tra lỗi trường 'email'
        expect(errors.isEmpty()).toBe(false); // Phải có lỗi
        const error = errors.mapped();
        expect(error).toHaveProperty('email');
        expect(error.email.msg).toBe(messages_1.USER_MESSAGES.INVALID_EMAIL);
    });
    it('should fail validation for password mismatch', async () => {
        const req = mockRequest({
            name: 'Quang Do',
            email: 'valid@example.com',
            password: 'ValidPass123!',
            confirm_password: 'DifferentPass123!', // Mật khẩu xác nhận không khớp
            date_of_birth: '2024-09-04T09:18:23.364Z'
        });
        const res = mockResponse();
        // Chạy validator trực tiếp
        await (0, users_middleware_1.registerValidator)(req, res, jest.fn());
        // Lấy kết quả validation
        const errors = (0, express_validator_1.validationResult)(req);
        // Kiểm tra lỗi trường 'confirm_password'
        expect(errors.isEmpty()).toBe(false); // Phải có lỗi
        const error = errors.mapped();
        expect(error).toHaveProperty('confirm_password');
        expect(error.confirm_password.msg).toBe(messages_1.USER_MESSAGES.PASSWORD_NOT_MATCH);
    });
    it('should fail validation for invalid date_of_birth', async () => {
        const req = mockRequest({
            name: 'Quang Do',
            email: 'valid@example.com',
            password: 'ValidPass123!',
            confirm_password: 'ValidPass123!',
            date_of_birth: 'invalid-date' // Ngày sinh không hợp lệ
        });
        const res = mockResponse();
        // Chạy validator trực tiếp
        await (0, users_middleware_1.registerValidator)(req, res, jest.fn());
        // Lấy kết quả validation
        const errors = (0, express_validator_1.validationResult)(req);
        // Kiểm tra lỗi trường 'date_of_birth'
        expect(errors.isEmpty()).toBe(false); // Phải có lỗi
        const error = errors.mapped();
        expect(error).toHaveProperty('date_of_birth');
        expect(error.date_of_birth.msg).toBe(messages_1.USER_MESSAGES.INVALID_DATE_OF_BIRTH);
    });
});
