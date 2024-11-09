import { ObjectId } from 'mongodb'
import { AddRoomTypeRequestBody } from '../../src/models/requests/RoomType.request'
import databaseService from '../../src/services/database.services'
import { roomTypeServices } from '../../src/services/roomType.services'

jest.mock('~/services/database.services')

describe('RoomType Services', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should add a room type', async () => {
    const payload: AddRoomTypeRequestBody = {
      name: 'Deluxe',
      description: 'A deluxe room'
    }
    const mockInsertResult = { insertedId: new ObjectId() }(
      databaseService.roomTypes.insertOne as jest.Mock
    ).mockResolvedValue(mockInsertResult)

    const result = await roomTypeServices.addRoomType(payload)

    expect(result).toEqual(new RoomType({ _id: mockInsertResult.insertedId, ...payload }))
  })

  it('should get all room types', async () => {
    const mockRoomTypes = [
      { _id: new ObjectId(), name: 'Deluxe', description: 'A deluxe room' },
      { _id: new ObjectId(), name: 'Standard', description: 'A standard room' }
    ]
    databaseService.roomTypes.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue(mockRoomTypes) })

    const result = await roomTypeServices.getRoomTypes()
    expect(result).toEqual(mockRoomTypes.map((roomType) => new RoomType(roomType)))
  })

  it('should get room type by id', async () => {
    const mockRoomType = { _id: new ObjectId(), name: 'Deluxe', description: 'A deluxe room' }
    databaseService.roomTypes.findOne.mockResolvedValue(mockRoomType)

    const result = await roomTypeServices.getRoomTypeById(mockRoomType._id.toString())
    expect(result).toEqual(new RoomType(mockRoomType))
  })

  it('should throw error if room type id is invalid', async () => {
    await expect(roomTypeServices.getRoomTypeById('invalid-id')).rejects.toThrow('Invalid ID format')
  })

  it('should update room type by id', async () => {
    const roomTypeId = new ObjectId()
    const payload: AddRoomTypeRequestBody = { name: 'Super Deluxe', description: 'An updated description' }
    const mockRoomType = { ...payload, _id: roomTypeId }
    databaseService.roomTypes.findOneAndUpdate.mockResolvedValue(mockRoomType)

    const result = await roomTypeServices.updateRoomTypeById(roomTypeId.toString(), payload)
    expect(result).toEqual(new RoomType(mockRoomType))
  })

  it('should delete room type by id', async () => {
    const roomTypeId = new ObjectId()
    databaseService.roomTypes.deleteOne.mockResolvedValue({ deletedCount: 1 })

    const result = await roomTypeServices.deleteRoomTypeById(roomTypeId.toString())
    expect(result).toBe(true)
  })
})
