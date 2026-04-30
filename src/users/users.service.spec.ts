import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  let service: UsersService;
  const mockUser: Partial<User> = {
    id: "507f1f77bcf86cd799439011",
    email: "test@example.com",
    nom: "Diallo",
    prenom: "Mamadou",
    role: "technicien",
    actif: true,
  };

  const mockUsers = [mockUser];

  const mockRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((entity) => {
      // Simulate persistence: return entity with mock id if missing
      return Promise.resolve({ ...mockUser, ...entity });
    }),
    find: jest.fn().mockImplementation((_options) => {
      // Filter mockUsers based on where clause if needed
      return Promise.resolve(mockUsers);
    }),
    findOne: jest.fn().mockImplementation((options) => {
      const id = options?.where?.id;
      return id ? Promise.resolve(mockUser as User) : Promise.resolve(null);
    }),
    delete: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ affected: 1 })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should return an array of users", async () => {
      const users = await service.findAll();
      expect(users).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({ where: {} });
    });

    it("should filter by organisationId", async () => {
      await service.findAll("org123");
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org123" },
      });
    });
  });

  describe("findById", () => {
    it("should return a user by id", async () => {
      const user = await service.findById("507f1f77bcf86cd799439011");
      expect(user).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "507f1f77bcf86cd799439011" },
      });
    });

    it("should throw NotFoundException when user not found", async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.findById("nonexistent")).rejects.toThrow(
        "User with ID nonexistent not found",
      );
    });
  });

  describe("create", () => {
    it("should create a new user", async () => {
      const createDto = {
        email: "new@example.com",
        nom: "Diop",
        prenom: "Awa",
        role: "technicien",
        password: "securePassword123",
      };
      const created = await service.create(createDto);
      expect(created).toMatchObject({
        email: createDto.email,
        nom: createDto.nom,
        prenom: createDto.prenom,
        role: createDto.role,
      });
      expect(created).toHaveProperty("id");
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update a user", async () => {
      const updateDto = { nom: "Diop" };
      const result = await service.update(
        "507f1f77bcf86cd799439011",
        updateDto,
      );
      expect(result.nom).toBe("Diop");
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete a user", async () => {
      await service.remove("507f1f77bcf86cd799439011");
      expect(mockRepository.delete).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
      );
    });

    it("should throw NotFoundException if user not found on delete", async () => {
      mockRepository.delete.mockResolvedValueOnce({ affected: 0 });
      await expect(service.remove("507f1f77bcf86cd799439011")).rejects.toThrow(
        "User with ID 507f1f77bcf86cd799439011 not found",
      );
    });
  });
});
