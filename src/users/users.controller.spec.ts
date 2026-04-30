import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/users.dto";

describe("UsersController", () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: "507f1f77bcf86cd799439011",
    email: "test@example.com",
    nom: "Diallo",
    prenom: "Mamadou",
    role: "technicien",
    actif: true,
  };

  const mockUsers = [mockUser];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(mockUsers),
            findById: jest.fn().mockResolvedValue(mockUser),
            create: jest
              .fn()
              .mockImplementation((dto: CreateUserDto) =>
                Promise.resolve({ id: "new-id", ...dto }),
              ),
            update: jest.fn().mockResolvedValue(mockUser),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should return an array of users", async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockUsers);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return a user by id", async () => {
      const result = await controller.findOne("507f1f77bcf86cd799439011");
      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    });
  });

  describe("create", () => {
    it("should create a user", async () => {
      const createDto: CreateUserDto = {
        email: "new@example.com",
        nom: "Diop",
        prenom: "Awa",
        role: "technicien",
        password: "securePassword123",
      };

      const result = await controller.create(createDto);
      expect(result).toMatchObject({
        id: "new-id",
        email: createDto.email,
        nom: createDto.nom,
        prenom: createDto.prenom,
        role: createDto.role,
      });
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe("update", () => {
    it("should update a user", async () => {
      const updateDto: UpdateUserDto = { nom: "Diop" };
      const result = await controller.update(
        "507f1f77bcf86cd799439011",
        updateDto,
      );
      expect(result).toEqual(mockUser);
      expect(service.update).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        updateDto,
      );
    });
  });

  describe("remove", () => {
    it("should remove a user", async () => {
      await controller.remove("507f1f77bcf86cd799439011");
      expect(service.remove).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    });
  });
});
