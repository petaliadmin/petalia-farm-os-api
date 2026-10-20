import { NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { SlackAlerterService } from "../common/alerting/slack-alerter.service";
import { WebsiteRequest } from "./entities/website-request.entity";
import { WebsiteService, normalizePhone, orderTotal } from "./website.service";

const ID = "8d3c1b2a-4e5f-4a6b-9c7d-0e1f2a3b4c5d";

function setup() {
  const requests = {
    create: jest.fn((data: Partial<WebsiteRequest>) => data),
    save: jest.fn((data: Partial<WebsiteRequest>) =>
      Promise.resolve({ id: ID, status: "new", ...data }),
    ),
    findOne: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  } as unknown as jest.Mocked<Repository<WebsiteRequest>>;
  const alerter = {
    notifyAndWait: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<SlackAlerterService>;
  return { service: new WebsiteService(requests, alerter), requests, alerter };
}

describe("WebsiteService", () => {
  it("enregistre un message de contact et prévient l'équipe", async () => {
    const { service, requests, alerter } = setup();

    const res = await service.submitContact({
      name: "Awa Ndiaye",
      phone: "77 123 45 67",
      email: "awa@exemple.sn",
      message: "Je souhaite équiper 5 ha de maraîchage.",
      subject: "Devis",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: true, id: ID, contactId: ID }),
    );
    expect(requests.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "contact",
        phone: "+221771234567",
        details: { subject: "Devis" },
      }),
    );
    expect(alerter.notifyAndWait).toHaveBeenCalledWith(
      expect.objectContaining({ key: `website.contact.${ID}` }),
    );
  });

  it("ignore silencieusement une demande dont le champ piège est rempli", async () => {
    const { service, requests, alerter } = setup();

    const res = await service.submitDemo({
      name: "Bot",
      phone: "+221770000000",
      farmSize: "5–20 ha",
      website: "http://spam.example",
    });

    expect(res.success).toBe(true);
    expect(requests.save).not.toHaveBeenCalled();
    expect(alerter.notifyAndWait).not.toHaveBeenCalled();
  });

  it("garde les champs de la démo dans details", async () => {
    const { service, requests } = setup();

    await service.submitDemo({
      name: "Moussa Sow",
      phone: "+221 76 000 00 00",
      email: "moussa@exemple.sn",
      farmSize: "20–100 ha",
      culture: "Riz",
      availability: "Flexible",
    });

    expect(requests.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "demo",
        message: null,
        details: {
          farmSize: "20–100 ha",
          culture: "Riz",
          availability: "Flexible",
        },
      }),
    );
  });

  it("recalcule le total d'une commande à partir des lignes", async () => {
    const { service, requests } = setup();

    await service.submitOrder({
      name: "GIE And Liggeey",
      phone: "+221771234567",
      deliveryLocation: "Mboro",
      lines: [
        { productId: "a", name: "Capteur", quantity: 2, unitPriceFcfa: 45000 },
        {
          productId: "b",
          name: "Passerelle",
          quantity: 1,
          unitPriceFcfa: 150000,
        },
      ],
    });

    expect(requests.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "order",
        totalFcfa: 240000,
        details: { deliveryLocation: "Mboro" },
      }),
    );
  });

  it("met à jour le statut et la note d'une demande", async () => {
    const { service, requests } = setup();
    requests.findOne.mockResolvedValue({
      id: ID,
      status: "new",
    } as WebsiteRequest);

    await service.update(ID, { status: "done", notes: "Rappelé le 21/10" });

    expect(requests.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", notes: "Rappelé le 21/10" }),
    );
  });

  it("renvoie 404 pour une demande inconnue", async () => {
    const { service, requests } = setup();
    requests.findOne.mockResolvedValue(null);

    await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["77 123 45 67", "+221771234567"],
    ["33-821-00-00", "+221338210000"],
    ["+221 77 123 45 67", "+221771234567"],
    ["0033612345678", "+33612345678"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});

describe("orderTotal", () => {
  it("additionne quantité × prix unitaire", () => {
    expect(
      orderTotal([
        { productId: "a", name: "A", quantity: 3, unitPriceFcfa: 1000 },
        { productId: "b", name: "B", quantity: 1, unitPriceFcfa: 500 },
      ]),
    ).toBe(3500);
  });
});
