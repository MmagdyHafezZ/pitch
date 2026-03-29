import { Test, TestingModule } from '@nestjs/testing';
import { PersonaController } from '../../controllers/persona.controller';
import {
  PersonaService,
  PersonaResponseDto,
  PersonaListResponseDto,
} from '../../services/persona.service';
import { CreatePersonaDto } from '../../dto/persona.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPersona: PersonaResponseDto = {
  id: 'persona-1',
  name: 'Alex',
  role: 'Buyer',
  description: 'A tough negotiator',
  orgId: 'org-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
} as unknown as PersonaResponseDto;

const mockPersonaList: PersonaListResponseDto = {
  personas: [mockPersona],
  total: 1,
} as unknown as PersonaListResponseDto;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PersonaController', () => {
  let controller: PersonaController;
  let service: jest.Mocked<PersonaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonaController],
      providers: [
        {
          provide: PersonaService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PersonaController>(PersonaController);
    service = module.get<jest.Mocked<PersonaService>>(PersonaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    const dto: CreatePersonaDto = {
      name: 'Alex',
      role: 'Buyer',
      description: 'A tough negotiator',
      orgId: 'org-1',
    } as unknown as CreatePersonaDto;

    it('should create a persona and return the result', async () => {
      service.create.mockResolvedValue(mockPersona);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPersona);
    });

    it('should propagate errors thrown by the service', async () => {
      const error = new Error('Validation failed');
      service.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toThrow('Validation failed');
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return all personas when no orgId is supplied', async () => {
      service.findAll.mockResolvedValue(mockPersonaList);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockPersonaList);
    });

    it('should pass orgId filter to the service', async () => {
      service.findAll.mockResolvedValue(mockPersonaList);

      const result = await controller.findAll('org-1');

      expect(service.findAll).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockPersonaList);
    });

    it('should return an empty list when no personas exist', async () => {
      const emptyList: PersonaListResponseDto = {
        personas: [],
        total: 0,
      } as unknown as PersonaListResponseDto;
      service.findAll.mockResolvedValue(emptyList);

      const result = await controller.findAll('org-2');

      expect(result).toEqual(emptyList);
    });

    it('should propagate errors thrown by the service', async () => {
      const error = new Error('DB error');
      service.findAll.mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return the persona for the given id', async () => {
      service.findById.mockResolvedValue(mockPersona);

      const result = await controller.findOne('persona-1');

      expect(service.findById).toHaveBeenCalledWith('persona-1');
      expect(result).toEqual(mockPersona);
    });

    it('should propagate errors thrown by the service (e.g. 404)', async () => {
      const error = new Error('Persona not found');
      service.findById.mockRejectedValue(error);

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        'Persona not found',
      );
    });
  });
});
