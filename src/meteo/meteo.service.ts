import { Injectable } from "@nestjs/common";

@Injectable()
export class MeteoService {
  async getByCoordinates(lat: number, lng: number) {
    // In production, would call OpenWeatherMap API
    return {
      data: {
        temperature: 28,
        humidite: 65,
        vent: 12,
        紫外线: "moderee",
        precipitation: 0,
        icon: "01d",
      },
    };
  }

  async getByVille(ville: string) {
    return {
      data: {
        temperature: 28,
        humidite: 65,
        vent: 12,
        precipitation: 0,
        icon: "01d",
      },
    };
  }

  async getPrevisions(ville: string) {
    return {
      data: [
        { jour: "Lun", tempMax: 32, tempMin: 24, icon: "01d" },
        { jour: "Mar", tempMax: 30, tempMin: 23, icon: "02d" },
        { jour: "Mer", tempMax: 28, tempMin: 22, icon: "10d" },
      ],
    };
  }
}
