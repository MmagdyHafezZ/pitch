import { InvitationRepository } from '../../repositories/invitation.repository';
import type { CreateInvitationData } from '../../repositories/invitation.repository';
import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';
import { Test, TestingModule } from '@nestjs/testing';

const mockInvitation = {
  _id: 'inv-1',
  sessionId: 'session-1',
  inviterId: 'user-1',
  inviterSnapshot: { name: 'Inviter' },
  inviteeId: 'user-2',
  inviteeSnapshot: { name: 'Invitee' },
  status: 'pending',
  message: 'Join my session!',
  respondedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const makeCreateData = (
  overrides?: Partial<CreateInvitationData>,
): CreateInvitationData => ({
  sessionId: 'session-1',
  inviterId: 'user-1',
  inviterSnapshot: { name: 'Inviter' },
  inviteeId: 'user-2',
  inviteeSnapshot: { name: 'Invitee' },
  message: 'Join my session!',
  ...overrides,
});

describe('InvitationRepository', () => {
  let repo: InvitationRepository;
  let mongoService: jest.Mocked<MongoConnectionService>;
  let mockModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockModel = {
      create: jest.fn(),
      insertMany: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
      sort: jest.fn(),
      lean: jest.fn(),
    };

    // Chain helpers — find/findById/sort all return the mock so .sort().lean() works
    mockModel.findById.mockReturnValue(mockModel);
    mockModel.find.mockReturnValue(mockModel);
    mockModel.findOne.mockReturnValue(mockModel);
    mockModel.findByIdAndUpdate.mockReturnValue(mockModel);
    mockModel.sort.mockReturnValue(mockModel);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationRepository,
        {
          provide: MongoConnectionService,
          useValue: {
            waitUntilConnected: jest.fn().mockResolvedValue(true),
            getModel: jest.fn().mockReturnValue(mockModel),
          },
        },
      ],
    }).compile();

    repo = module.get<InvitationRepository>(InvitationRepository);
    mongoService = module.get(MongoConnectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates an invitation and returns plain object', async () => {
      const docWithToObject = {
        ...mockInvitation,
        toObject: jest.fn().mockReturnValue(mockInvitation),
      };
      mockModel.create.mockResolvedValue(docWithToObject);

      const result = await repo.create(makeCreateData());

      expect(result).toEqual(mockInvitation);
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(String),
          sessionId: 'session-1',
          inviterId: 'user-1',
          inviteeId: 'user-2',
          status: 'pending',
          message: 'Join my session!',
        }),
      );
    });

    it('throws when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repo.create(makeCreateData())).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createMany
  // ---------------------------------------------------------------------------

  describe('createMany', () => {
    it('returns count of 0 immediately when invitations array is empty', async () => {
      const result = await repo.createMany([]);

      expect(result).toEqual({ count: 0 });
      expect(mockModel.insertMany).not.toHaveBeenCalled();
    });

    it('inserts multiple invitations and returns the count', async () => {
      mockModel.insertMany.mockResolvedValue([mockInvitation, mockInvitation]);

      const result = await repo.createMany([
        makeCreateData(),
        makeCreateData(),
      ]);

      expect(result).toEqual({ count: 2 });
      expect(mockModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sessionId: 'session-1',
            status: 'pending',
          }),
        ]),
        { ordered: false },
      );
    });

    it('returns count of 0 when insertMany returns non-array', async () => {
      mockModel.insertMany.mockResolvedValue({ acknowledged: true } as any);

      const result = await repo.createMany([makeCreateData()]);

      expect(result).toEqual({ count: 0 });
    });

    it('throws when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repo.createMany([makeCreateData()])).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns invitation when found', async () => {
      mockModel.lean.mockResolvedValue(mockInvitation);

      const result = await repo.findById('inv-1');

      expect(result).toEqual(mockInvitation);
      expect(mockModel.findById).toHaveBeenCalledWith('inv-1');
      expect(mockModel.lean).toHaveBeenCalled();
    });

    it('returns null when not found', async () => {
      mockModel.lean.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('throws when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repo.findById('inv-1')).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findBySessionId
  // ---------------------------------------------------------------------------

  describe('findBySessionId', () => {
    it('returns invitations for a session sorted by createdAt desc', async () => {
      mockModel.lean.mockResolvedValue([mockInvitation]);

      const result = await repo.findBySessionId('session-1');

      expect(result).toEqual([mockInvitation]);
      expect(mockModel.find).toHaveBeenCalledWith({ sessionId: 'session-1' });
      expect(mockModel.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('returns empty array when no invitations exist for session', async () => {
      mockModel.lean.mockResolvedValue([]);

      const result = await repo.findBySessionId('session-nobody');

      expect(result).toEqual([]);
    });

    it('throws when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repo.findBySessionId('session-1')).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findByInviteeId
  // ---------------------------------------------------------------------------

  describe('findByInviteeId', () => {
    it('returns invitations for an invitee without status filter', async () => {
      mockModel.lean.mockResolvedValue([mockInvitation]);

      const result = await repo.findByInviteeId('user-2');

      expect(result).toEqual([mockInvitation]);
      expect(mockModel.find).toHaveBeenCalledWith({ inviteeId: 'user-2' });
    });

    it('applies status filter when provided', async () => {
      mockModel.lean.mockResolvedValue([mockInvitation]);

      await repo.findByInviteeId('user-2', 'pending');

      expect(mockModel.find).toHaveBeenCalledWith({
        inviteeId: 'user-2',
        status: 'pending',
      });
    });

    it('returns empty array when invitee has no invitations', async () => {
      mockModel.lean.mockResolvedValue([]);

      const result = await repo.findByInviteeId('user-nobody');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findByInviterId
  // ---------------------------------------------------------------------------

  describe('findByInviterId', () => {
    it('returns invitations sent by an inviter without status filter', async () => {
      mockModel.lean.mockResolvedValue([mockInvitation]);

      const result = await repo.findByInviterId('user-1');

      expect(result).toEqual([mockInvitation]);
      expect(mockModel.find).toHaveBeenCalledWith({ inviterId: 'user-1' });
    });

    it('applies status filter when provided', async () => {
      mockModel.lean.mockResolvedValue([]);

      await repo.findByInviterId('user-1', 'accepted');

      expect(mockModel.find).toHaveBeenCalledWith({
        inviterId: 'user-1',
        status: 'accepted',
      });
    });

    it('returns empty array when inviter has no invitations', async () => {
      mockModel.lean.mockResolvedValue([]);

      const result = await repo.findByInviterId('user-nobody');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // updateStatus
  // ---------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('updates status to non-pending and sets respondedAt', async () => {
      const updated = {
        ...mockInvitation,
        status: 'accepted',
        respondedAt: new Date(),
      };
      mockModel.lean.mockResolvedValue(updated);

      const result = await repo.updateStatus('inv-1', 'accepted');

      expect(result).toEqual(updated);
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'inv-1',
        { status: 'accepted', respondedAt: expect.any(Date) },
        { new: true },
      );
    });

    it('sets respondedAt to null when status is pending', async () => {
      mockModel.lean.mockResolvedValue(mockInvitation);

      await repo.updateStatus('inv-1', 'pending');

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'inv-1',
        { status: 'pending', respondedAt: null },
        { new: true },
      );
    });

    it('throws when invitation not found', async () => {
      mockModel.lean.mockResolvedValue(null);

      await expect(
        repo.updateStatus('nonexistent', 'accepted'),
      ).rejects.toThrow('Invitation with ID nonexistent not found');
    });

    it('throws when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repo.updateStatus('inv-1', 'accepted')).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // existsForSessionAndInvitee
  // ---------------------------------------------------------------------------

  describe('existsForSessionAndInvitee', () => {
    it('returns invitation when one exists', async () => {
      mockModel.lean.mockResolvedValue(mockInvitation);

      const result = await repo.existsForSessionAndInvitee(
        'session-1',
        'user-2',
      );

      expect(result).toEqual(mockInvitation);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        sessionId: 'session-1',
        inviteeId: 'user-2',
      });
    });

    it('returns null when no invitation exists', async () => {
      mockModel.lean.mockResolvedValue(null);

      const result = await repo.existsForSessionAndInvitee(
        'session-1',
        'user-nobody',
      );

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes invitation by id', async () => {
      mockModel.findByIdAndDelete = jest.fn().mockResolvedValue(mockInvitation);

      await repo.delete('inv-1');

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('inv-1');
    });

    it('throws when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repo.delete('inv-1')).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // countPendingForInvitee
  // ---------------------------------------------------------------------------

  describe('countPendingForInvitee', () => {
    it('returns count of pending invitations for an invitee', async () => {
      mockModel.countDocuments.mockResolvedValue(3);

      const result = await repo.countPendingForInvitee('user-2');

      expect(result).toBe(3);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        inviteeId: 'user-2',
        status: 'pending',
      });
    });

    it('returns 0 when invitee has no pending invitations', async () => {
      mockModel.countDocuments.mockResolvedValue(0);

      const result = await repo.countPendingForInvitee('user-nobody');

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // countBySessionAndStatus
  // ---------------------------------------------------------------------------

  describe('countBySessionAndStatus', () => {
    it('counts invitations for a session without status filter', async () => {
      mockModel.countDocuments.mockResolvedValue(5);

      const result = await repo.countBySessionAndStatus('session-1');

      expect(result).toBe(5);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        sessionId: 'session-1',
      });
    });

    it('counts invitations for a session with status filter', async () => {
      mockModel.countDocuments.mockResolvedValue(2);

      const result = await repo.countBySessionAndStatus(
        'session-1',
        'accepted',
      );

      expect(result).toBe(2);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        sessionId: 'session-1',
        status: 'accepted',
      });
    });

    it('returns 0 when session has no invitations', async () => {
      mockModel.countDocuments.mockResolvedValue(0);

      const result = await repo.countBySessionAndStatus('session-nobody');

      expect(result).toBe(0);
    });
  });
});
