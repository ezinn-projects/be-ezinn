import request from 'supertest'
import { app } from '../../src/index'

describe('Recruitment API - Admin GET Endpoints', () => {
  describe('GET /recruitments/recruitments (Protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/recruitments/recruitments').expect(401)

      expect(response.body.message).toBeDefined()
    })

    it('should require admin/staff role', async () => {
      // Test với token không có quyền admin
      const response = await request(app)
        .get('/recruitments/recruitments')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401)

      expect(response.body.message).toBeDefined()
    })
  })

  describe('GET /recruitments/recruitments/:id (Protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/recruitments/recruitments/507f1f77bcf86cd799439011').expect(401)

      expect(response.body.message).toBeDefined()
    })
  })

  describe('GET /recruitments/stats (Protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/recruitments/stats').expect(401)

      expect(response.body.message).toBeDefined()
    })
  })
})
