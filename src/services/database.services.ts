import { Collection, Db, MongoClient } from 'mongodb'
import { User } from '~/models/schemas/User.schema'
import dotenv from 'dotenv'
import { HouseRule } from '~/models/schemas/HouseRules.schema'
import RoomType from '~/models/schemas/RoomType.schema'
dotenv.config()

const DB_USERNAME = process.env.DB_USERNAME
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_NAME = process.env.DB_NAME
const VPS_IP = process.env.VPS_IP
const uri = `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${VPS_IP}:27017/${DB_NAME}?authSource=admin`

class DatabaseService {
  private client: MongoClient
  private db: Db
  constructor() {
    this.client = new MongoClient(uri)
    this.db = this.client.db(DB_NAME)
  }

  async connect() {
    try {
      // Send a ping to confirm a successful connection
      await this.db.command({ ping: 1 })
      console.log('Pinged your deployment. You successfully connected to MongoDB!')
    } catch (error) {
      console.error(error)
    } finally {
      // Ensures that the client will close when you finish/error
      // await this.client.close()
    }
  }

  get users(): Collection<User> {
    return this.db.collection('users')
  }

  get houseRules(): Collection<HouseRule> {
    return this.db.collection('houseRules')
  }

  get roomTypes(): Collection<RoomType> {
    return this.db.collection('roomTypes')
  }
}

const databaseService = new DatabaseService()
export default databaseService
