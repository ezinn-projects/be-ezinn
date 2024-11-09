"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// import { app } from '../src/index' // Đường dẫn tới ứng dụng Express.js của bạn
const mongodb_1 = require("mongodb"); // Nếu sử dụng MongoDB
const mongodb_memory_server_1 = require("mongodb-memory-server"); // Nếu dùng MongoDB in-memory cho test
const httpStatus_1 = require("~/constants/httpStatus");
const messages_1 = require("~/constants/messages");
const index_1 = require("~/index");
const User_schema_1 = require("~/models/schemas/User.schema");
const crypto_1 = require("~/utils/crypto");
let mongoServer;
let client;
let db;
beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = new mongodb_1.MongoClient(uri);
    await client.connect();
    db = client.db('testdb'); // Sử dụng database tạm thời cho test
});
afterAll(async () => {
    await client.close();
    await mongoServer.stop();
});
afterEach(async () => {
    await db.collection('users').deleteMany({});
});
describe('Integration Test for Register API', () => {
    it('should register successfully with valid data', async () => {
        // Kiểm tra không có người dùng trước khi test
        const userCountBefore = await db.collection('users').countDocuments();
        expect(userCountBefore).toBe(0); // Đảm bảo không có người dùng nào
        const email = `quangdo${new Date().valueOf()}@gmail.com`;
        const payload = {
            name: 'Quang Do',
            email,
            password: 'ValidPass123!',
            confirm_password: 'ValidPass123!',
            date_of_birth: '2000-01-01'
        };
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/users/register') // Endpoint cần test
            .send(payload);
        // Kiểm tra mã trạng thái HTTP
        expect(res.statusCode).toBe(httpStatus_1.HTTP_STATUS_CODE.CREATED);
        // Kiểm tra phản hồi trả về
        expect(res.body).toHaveProperty('message', messages_1.USER_MESSAGES.REGISTER_SUCCESS);
        const result = await db.collection('users').insertOne(new User_schema_1.User({
            ...payload,
            date_of_birth: new Date(payload.date_of_birth),
            password: (0, crypto_1.hashPassword)(payload.password)
        }));
        expect(result).toBeTruthy();
        // Kiểm tra dữ liệu người dùng đã được lưu vào database
        const user = await db.collection('users').findOne({ email });
        expect(user).toBeTruthy();
        expect(user.email).toBe(email);
    });
    it('should return error when user already exists', async () => {
        // Đầu tiên đăng ký một người dùng
        await db.collection('users').insertOne({
            name: 'Quang Do',
            email: 'quangdo@example.com',
            password: 'ValidPass123!',
            date_of_birth: '2000-01-01'
        });
        // Thử đăng ký lại với cùng email
        const res = await (0, supertest_1.default)(index_1.app).post('/users/register').send({
            name: 'Quang Do',
            email: 'quangdo@example.com', // Email đã tồn tại
            password: 'ValidPass123!',
            confirm_password: 'ValidPass123!',
            date_of_birth: '2000-01-01'
        });
        console.log('res', res.statusCode);
        // Kiểm tra mã trạng thái HTTP
        expect(res.statusCode).toBe(httpStatus_1.HTTP_STATUS_CODE.CONFLICT); // 409 Conflict khi người dùng đã tồn tại
        // Kiểm tra phản hồi trả về
        expect(res.body).toHaveProperty('message', messages_1.USER_MESSAGES.USER_EXISTS);
    });
});
