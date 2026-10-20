import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { WebsitePublicController } from "./website.controller";
import { WebsiteService } from "./website.service";

/** Validation des formulaires publics, avec la même ValidationPipe que main.ts. */
describe("WebsitePublicController", () => {
  let app: INestApplication;
  const service = {
    submitContact: jest.fn().mockResolvedValue({ success: true }),
    submitDemo: jest.fn().mockResolvedValue({ success: true }),
    submitOrder: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: "global", ttl: 60_000, limit: 100 }]),
      ],
      controllers: [WebsitePublicController],
      providers: [{ provide: WebsiteService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it("accepte le formulaire de contact tel que l'envoie le site", async () => {
    await request(app.getHttpServer())
      .post("/public/contact")
      .send({
        name: "  Awa Ndiaye ",
        phone: "+221771234567",
        email: "Awa@Exemple.SN",
        message: "Bonjour, je souhaite un devis.",
      })
      .expect(201);

    expect(service.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Awa Ndiaye", email: "awa@exemple.sn" }),
    );
  });

  it("refuse un téléphone invalide et un message trop court", async () => {
    const res = await request(app.getHttpServer())
      .post("/public/contact")
      .send({ name: "Awa", phone: "abc", message: "court" })
      .expect(400);

    expect(JSON.stringify(res.body.message)).toContain("téléphone");
    expect(service.submitContact).not.toHaveBeenCalled();
  });

  it("refuse les champs inconnus", async () => {
    await request(app.getHttpServer())
      .post("/public/demo-requests")
      .send({
        name: "Moussa",
        phone: "+221770000000",
        farmSize: "5–20 ha",
        role: "admin",
      })
      .expect(400);
  });

  it("exige au moins une ligne valide dans une commande", async () => {
    await request(app.getHttpServer())
      .post("/public/orders")
      .send({ name: "Moussa", phone: "+221770000000", lines: [] })
      .expect(400);

    await request(app.getHttpServer())
      .post("/public/orders")
      .send({
        name: "Moussa",
        phone: "+221770000000",
        lines: [
          { productId: "a", name: "Capteur", quantity: 0, unitPriceFcfa: 100 },
        ],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/public/orders")
      .send({
        name: "Moussa",
        phone: "+221770000000",
        lines: [
          {
            productId: "a",
            name: "Capteur",
            quantity: 2,
            unitPriceFcfa: 45000,
          },
        ],
      })
      .expect(201);
    expect(service.submitOrder).toHaveBeenCalledTimes(1);
  });
});
