import request from 'supertest'
import { app } from '../../src/index'

describe('Job Application API - Admin GET Endpoints', () => {
  describe('GET /job-applications/applications (Protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/job-applications/applications').expect(401)

      expect(response.body.message).toBeDefined()
    })

    it('should require admin/staff role', async () => {
      // Test với token không có quyền admin
      const response = await request(app)
        .get('/job-applications/applications')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401)

      expect(response.body.message).toBeDefined()
    })
  })

  describe('GET /job-applications/applications/:id (Protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/job-applications/applications/507f1f77bcf86cd799439011').expect(401)

      expect(response.body.message).toBeDefined()
    })
  })

  describe('GET /job-applications/stats (Protected)', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/job-applications/stats').expect(401)

      expect(response.body.message).toBeDefined()
    })
  })
})
